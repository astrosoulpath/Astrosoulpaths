export function assignRoles(p1: any, p2: any) {
  if (p1.gender === p2.gender) {
    throw new Error('Match must be between male and female');
  }

  return {
    boy: p1.gender === 'MALE' ? p1 : p2,
    girl: p1.gender === 'FEMALE' ? p1 : p2,
  };
}
