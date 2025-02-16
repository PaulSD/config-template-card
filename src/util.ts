export function isString(testObj: any): testObj is string {
  return (typeof testObj === 'string' || testObj instanceof String);
}
