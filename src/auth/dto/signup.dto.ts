// src/auth/dto/signup.dto.ts
import { z } from 'zod';

export const SignupSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required." }),
  lastName: z.string().min(1, { message: "Last name is required." }),
  email: z.string().email({ message: "Invalid email format." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters long." }),
  confirmPassword: z.string().min(8, { message: "Confirm password is required." }),
  phone: z
    .string()
    .regex(/^\d{10,15}$/, { message: "Check your number and try again. It must be 10-15 digits with no spaces or symbols." }),
  plan: z.enum(["free", "bronze", "silver", "gold"], { message: "Invalid plan selected." }),
  roles: z.array(z.string()).optional(),
});
