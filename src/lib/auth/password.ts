import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/** هش کد OTP — نگهداری کد خام در پایگاه داده ممنوع است */
export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 8);
}

export async function verifyOtp(code: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(code, hash);
  } catch {
    return false;
  }
}

export interface PasswordStrength {
  ok: boolean;
  message?: string;
}

export function checkPasswordStrength(password: string): PasswordStrength {
  if (password.length < 8) return { ok: false, message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' };
  if (password.length > 72) return { ok: false, message: 'رمز عبور نباید بیش از ۷۲ کاراکتر باشد.' };
  if (!/[a-zA-Z]/.test(password)) return { ok: false, message: 'رمز عبور باید حداقل یک حرف انگلیسی داشته باشد.' };
  if (!/\d/.test(password)) return { ok: false, message: 'رمز عبور باید حداقل یک عدد داشته باشد.' };
  const weak = ['password', '12345678', 'qwertyui', 'padel123', 'iloveyou'];
  if (weak.includes(password.toLowerCase())) return { ok: false, message: 'رمز عبور بسیار ساده است.' };
  return { ok: true };
}
