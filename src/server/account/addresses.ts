import "server-only";
import { db, type Prisma } from "@/lib/db";
import { err } from "@/lib/api";
import type { AddressView } from "@/server/checkout/types";
import type { AddressData } from "./schemas";

/** ADDRESS BOOK — a customer's saved delivery addresses (always filtered by userId). */

const MAX_ADDRESSES = 20;

export const addressSelect = {
  id: true,
  label: true,
  name: true,
  phone: true,
  line1: true,
  line2: true,
  landmark: true,
  city: true,
  state: true,
  pincode: true,
  isDefault: true,
} satisfies Prisma.AddressSelect;

export async function listAddresses(userId: string): Promise<AddressView[]> {
  return db.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], select: addressSelect });
}

export async function getAddress(userId: string, id: string): Promise<AddressView | null> {
  return db.address.findFirst({ where: { id, userId }, select: addressSelect });
}

export async function createAddress(userId: string, data: AddressData): Promise<AddressView> {
  return db.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) throw err.unprocessable(`You can save up to ${MAX_ADDRESSES} addresses — delete one first`);
    const makeDefault = count === 0 || data.isDefault === true;
    if (makeDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return tx.address.create({
      data: { userId, label: data.label, name: data.name, phone: data.phone, line1: data.line1, line2: data.line2, landmark: data.landmark, city: data.city, state: data.state, pincode: data.pincode, isDefault: makeDefault },
      select: addressSelect,
    });
  });
}

export async function updateAddress(userId: string, id: string, patch: Partial<AddressData>): Promise<AddressView> {
  return db.$transaction(async (tx) => {
    const current = await tx.address.findFirst({ where: { id, userId }, select: { id: true, isDefault: true } });
    if (!current) throw err.notFound("Address not found");
    if (patch.isDefault === true) await tx.address.updateMany({ where: { userId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
    const { isDefault, ...fields } = patch;
    const data: Prisma.AddressUpdateInput = { ...fields };
    // the default can be moved to another address, not simply switched off
    if (isDefault === true) data.isDefault = true;
    return tx.address.update({ where: { id }, data, select: addressSelect });
  });
}

/** Deletes an address; when it was the default, the most recently used remaining address becomes the default. */
export async function deleteAddress(userId: string, id: string): Promise<{ ok: true; defaultId: string | null }> {
  return db.$transaction(async (tx) => {
    const current = await tx.address.findFirst({ where: { id, userId }, select: { id: true, isDefault: true } });
    if (!current) throw err.notFound("Address not found");
    await tx.address.delete({ where: { id } });
    let defaultId: string | null = null;
    if (current.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true } });
      if (next) {
        await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
        defaultId = next.id;
      }
    }
    return { ok: true as const, defaultId };
  });
}
