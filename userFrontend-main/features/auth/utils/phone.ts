export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function toE164Phone(callingCode: string, nationalNumber: string) {
  const cc = digitsOnly(callingCode);
  const number = digitsOnly(nationalNumber);
  return `+${cc}${number}`;
}

export function maskPhone(phone: string) {
  if (phone.length < 4) {
    return phone;
  }
  return `${phone.slice(0, 4)}${"*".repeat(Math.max(0, phone.length - 7))}${phone.slice(-3)}`;
}
