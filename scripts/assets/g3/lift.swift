// On-device subject lifting with Apple Vision (no network, no models to download).
// Usage: swift lift.swift <in.jpg> <out-mask.png> [instanceIndex|all]
// Writes a grayscale mask (white = subject) at the source image's pixel size,
// and prints the number of foreground instances found.
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: lift <in> <outmask> [idx|all]"); exit(2) }
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
let which = args.count > 3 ? args[3] : "all"

guard let src = CGImageSourceCreateWithURL(inURL as CFURL, nil),
      let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("cannot read"); exit(1) }
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
let req = VNGenerateForegroundInstanceMaskRequest()
do { try handler.perform([req]) } catch { print("vision error \(error)"); exit(1) }
guard let obs = req.results?.first else { print("instances 0"); exit(3) }
var set = obs.allInstances
if which != "all", let i = Int(which) { set = IndexSet(integer: i) }
print("instances \(obs.allInstances.count)")
do {
    let buf = try obs.generateScaledMaskForImage(forInstances: set, from: handler)
    let ci = CIImage(cvPixelBuffer: buf)
    let ctx = CIContext()
    let gray = CGColorSpaceCreateDeviceGray()
    try ctx.writePNGRepresentation(of: ci, to: outURL, format: .L8, colorSpace: gray)
} catch { print("mask error \(error)"); exit(1) }
