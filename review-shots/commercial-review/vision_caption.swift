import Foundation
import Vision
import AppKit

// Caption each sheet with Apple Vision (on-device) for subject-identity signal only.
let files = CommandLine.arguments.dropFirst()
for f in files {
    let url = URL(fileURLWithPath: f)
    guard let img = NSImage(contentsOf: url),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        print("\(url.lastPathComponent): LOAD_FAIL")
        continue
    }
    let request = VNDescribeImagesRequest()
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    do {
        try handler.perform([request])
        let caps = (request.results ?? []).compactMap { $0 as? VNClassificationObservation }
            .prefix(3)
            .map { "\($0.identifier) [\(String(format: "%.2f", $0.confidence))]" }
        print("\(url.lastPathComponent): \(caps.joined(separator: " | "))")
    } catch {
        print("\(url.lastPathComponent): ERR \(error.localizedDescription)")
    }
}
