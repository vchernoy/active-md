/** Character budget for bounded number controls; unbounded controls keep the CSS default. */
export function inputWidth(min: string, max: string, value: string, step: string): number {
  if (!min.trim() || !max.trim() || !Number.isFinite(Number(min)) || !Number.isFinite(Number(max))) return 8;
  const decimals = (text: string): number => {
    const [mantissa = '', exponent = '0'] = text.toLowerCase().split('e');
    return Math.max(0, (mantissa.split('.')[1]?.length ?? 0) - Number(exponent));
  };
  const precision = Math.min(20, Math.max(...[min, max, value, step].filter(text => text.trim() && Number.isFinite(Number(text))).map(decimals)));
  const length = (text: string): number => {
    const number = Number(text);
    if (!text.trim() || !Number.isFinite(number)) return 0;
    // Large exponential values already exceed the maximum useful input width.
    if (Math.abs(number) >= 1e12) return 12;
    return number.toFixed(precision).length;
  };
  return Math.max(3, Math.min(12, Math.max(length(min), length(max), length(value)) + 1));
}
