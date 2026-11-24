// Subject cut-out using Apple's on-device Vision framework (macOS 14+).
// Build: swiftc -O lift.swift -o ../../../.shots/assets-raw/g2/bin/lift
// Usage: lift <input.png> <output.png> [instance indexes, e.g. "1,2" | "all" (default)]
// Prints the number of foreground instances and the bounding box (normalised, origin top-left) of each.
import AppKit
import CoreImage
import Foundation
import Vision

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write("usage: lift <in> <out> [all|1,2]\n".data(using: .utf8)!)
    exit(2)
}
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
let pick = args.count > 3 ? args[3] : "all"

let handler = VNImageRequestHandler(url: inURL, options: [:])
let request = VNGenerateForegroundInstanceMaskRequest()
do {
    try handler.perform([request])
} catch {
    print("ERROR perform \(error)")
    exit(1)
}
guard let obs = request.results?.first else {
    print("instances 0")
    exit(3)
}
let all = obs.allInstances
print("instances \(all.count)")

// bounding boxes per instance
for idx in all.sorted() {
    if let mask = try? obs.generateScaledMaskForImage(forInstances: IndexSet(integer: idx), from: handler) {
        let ci = CIImage(cvPixelBuffer: mask)
        let w = CVPixelBufferGetWidth(mask), h = CVPixelBufferGetHeight(mask)
        CVPixelBufferLockBaseAddress(mask, .readOnly)
        let base = CVPixelBufferGetBaseAddress(mask)!.assumingMemoryBound(to: Float32.self)
        let stride = CVPixelBufferGetBytesPerRow(mask) / 4
        var minX = w, minY = h, maxX = 0, maxY = 0, count = 0
        for y in Swift.stride(from: 0, to: h, by: 2) {
            for x in Swift.stride(from: 0, to: w, by: 2) where base[y * stride + x] > 0.5 {
                minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y); count += 1
            }
        }
        CVPixelBufferUnlockBaseAddress(mask, .readOnly)
        _ = ci
        let area = Double(count * 4) / Double(w * h)
        print(String(format: "instance %d box x=%.3f y=%.3f w=%.3f h=%.3f area=%.3f", idx,
                     Double(minX) / Double(w), Double(minY) / Double(h),
                     Double(maxX - minX) / Double(w), Double(maxY - minY) / Double(h), area))
    }
}

var chosen = all
if pick != "all" {
    chosen = IndexSet(pick.split(separator: ",").compactMap { Int($0) })
}
do {
    let buf = try obs.generateMaskedImage(ofInstances: chosen, from: handler, croppedToInstancesExtent: true)
    let ci = CIImage(cvPixelBuffer: buf)
    let ctx = CIContext()
    guard let cs = CGColorSpace(name: CGColorSpace.sRGB) else { exit(4) }
    try ctx.writePNGRepresentation(of: ci, to: outURL, format: .RGBA8, colorSpace: cs)
    print("wrote \(outURL.path)")
} catch {
    print("ERROR mask \(error)")
    exit(1)
}
