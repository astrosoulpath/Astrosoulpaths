import { BadRequestException, Injectable } from '@nestjs/common';

export interface LocalNumerologyResult {
  source: 'local-numerology';
  system: 'pythagorean';
  fullName: string;
  dob: string;
  lifePathNumber: number;
  birthNumber: number;
  expressionNumber: number;
  soulUrgeNumber: number;
  personalityNumber: number;
}

@Injectable()
export class NumerologyService {
  calculate(fullName: string, dob: string): LocalNumerologyResult {
    const name = fullName.trim();

    if (!name) {
      throw new BadRequestException('Full name is required for numerology');
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);

    if (!match) {
      throw new BadRequestException(
        'Date of birth must be in YYYY-MM-DD format',
      );
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException('Invalid date of birth');
    }

    const lifePathNumber = this.reduceNumber(
      this.sumDigits(`${year}${match[2]}${match[3]}`),
    );

    const birthNumber = this.reduceNumber(day);

    const letters = name
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .split('');

    if (letters.length === 0) {
      throw new BadRequestException(
        'Full name must contain alphabetic characters',
      );
    }

    const vowels = new Set(['A', 'E', 'I', 'O', 'U']);

    const expressionTotal = letters.reduce(
      (sum, letter) => sum + this.letterValue(letter),
      0,
    );

    const soulUrgeTotal = letters
      .filter((letter) => vowels.has(letter))
      .reduce((sum, letter) => sum + this.letterValue(letter), 0);

    const personalityTotal = letters
      .filter((letter) => !vowels.has(letter))
      .reduce((sum, letter) => sum + this.letterValue(letter), 0);

    return {
      source: 'local-numerology',
      system: 'pythagorean',
      fullName: name,
      dob,
      lifePathNumber,
      birthNumber,
      expressionNumber: this.reduceNumber(expressionTotal),
      soulUrgeNumber: this.reduceNumber(soulUrgeTotal),
      personalityNumber: this.reduceNumber(personalityTotal),
    };
  }

  private letterValue(letter: string): number {
    return ((letter.charCodeAt(0) - 65) % 9) + 1;
  }

  private sumDigits(value: string): number {
    return value
      .split('')
      .reduce((sum, digit) => sum + Number(digit), 0);
  }

  private reduceNumber(value: number): number {
    let current = value;

    while (current > 9 && current !== 11 && current !== 22 && current !== 33) {
      current = this.sumDigits(String(current));
    }

    return current;
  }
}
