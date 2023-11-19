import crc32 from "crc/crc32";
import convert from "color-convert";

const goldenRatio = 0.618033988749895;

/**
 * Use a hash to determine convert a string to a color in a reproducible way.
 *
 * Borrowed from sACNView's algorithm.
 * @param value
 */
export default function calcStringColor(value: string) {
  const idHash = crc32(value);
  const hue = (goldenRatio * idHash) % 1.0;
  const sat = ((goldenRatio * idHash * 2) % 0.25) + 0.75;
  // Adjust lightness if you want to support a dark mode.
  const light = 0.5;
  // Convert expects integer percentages.
  const color = convert.hsl.hex([hue * 100, sat * 100, light * 100]);

  return `#${color}`;
}
