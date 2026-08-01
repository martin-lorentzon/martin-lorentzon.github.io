/**
 * Parses a CSS color string or an element's computed background color into
 * normalized RGBA factors: [r, g, b, a].
 */
export function parseColorToFactor(input) {
  let bgColor;

  if (typeof input === 'string') {
    bgColor = input;
  } else {
    bgColor = window.getComputedStyle(input).color;
  }

  const numbers = bgColor.match(/\d+/g);
  
  if (!numbers || numbers.length < 3) {
    console.warn('Could not parse color:', input);
    return [1, 1, 1, 1];
  }

  return [
    parseInt(numbers[0]) / 255,
    parseInt(numbers[1]) / 255,
    parseInt(numbers[2]) / 255,
    numbers[3] !== undefined ? parseFloat(numbers[3]) : 1
  ];
}