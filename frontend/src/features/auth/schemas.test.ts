import { describe, expect, it } from 'vitest';

import { loginSchema, registerSchema, resetPasswordSchema, scorePassword } from './schemas';

const issues = (result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[] }> } }) =>
  result.error?.issues.map((issue) => issue.path.join('.')) ?? [];

describe('auth form schemas', () => {
  it('normalizes and validates the login form', () => {
    const valid = loginSchema.safeParse({
      email: '  alex@example.com ',
      password: 'x',
      rememberMe: true,
    });
    expect(valid.success).toBe(true);
    expect(valid.data?.email).toBe('alex@example.com');

    const invalid = loginSchema.safeParse({
      email: 'not-an-email',
      password: '',
      rememberMe: false,
    });
    expect(issues(invalid)).toEqual(['email', 'password']);
  });

  it('requires a strong enough password, matching confirmation and accepted terms on sign-up', () => {
    const base = {
      name: 'Alex Morgan',
      email: 'alex@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
      acceptTerms: true,
    };
    expect(registerSchema.safeParse(base).success).toBe(true);
    expect(
      issues(registerSchema.safeParse({ ...base, password: 'short1', confirmPassword: 'short1' })),
    ).toEqual(['password']);
    expect(
      issues(
        registerSchema.safeParse({
          ...base,
          password: 'lettersonly',
          confirmPassword: 'lettersonly',
        }),
      ),
    ).toEqual(['password']);
    expect(issues(registerSchema.safeParse({ ...base, confirmPassword: 'Password124' }))).toEqual([
      'confirmPassword',
    ]);
    expect(issues(registerSchema.safeParse({ ...base, acceptTerms: false }))).toEqual([
      'acceptTerms',
    ]);
    expect(issues(registerSchema.safeParse({ ...base, name: ' A ' }))).toEqual(['name']);
  });

  it('checks the reset-password confirmation', () => {
    expect(
      resetPasswordSchema.safeParse({ password: 'Password123', confirmPassword: 'Password123' })
        .success,
    ).toBe(true);
    expect(
      issues(resetPasswordSchema.safeParse({ password: 'Password123', confirmPassword: 'nope' })),
    ).toEqual(['confirmPassword']);
  });

  it('scores password strength from 0 to 4', () => {
    expect(scorePassword('')).toBe(0);
    expect(scorePassword('abcdefgh')).toBe(1);
    expect(scorePassword('abcdefghijkl')).toBe(2);
    expect(scorePassword('Abcdefghijk1!')).toBe(4);
  });
});
