import { z } from "zod"

export const customerProfileSchema = z.object({
  username: z.string().trim().toLowerCase().min(3, "Use at least 3 characters for the username.").max(40, "Use no more than 40 characters for the username.").regex(/^[a-z0-9_-]+$/, "Use letters, numbers, underscores or hyphens for the username."),
  firstName: z.string().trim().min(1, "Enter the first name.").max(100, "Use no more than 100 characters for the first name."),
  lastName: z.string().trim().min(1, "Enter the last name.").max(100, "Use no more than 100 characters for the last name."),
  company: z.string().trim().max(200, "Use no more than 200 characters for the company."),
  phone: z.string().trim().max(50, "Use no more than 50 characters for the phone."),
  jobTitle: z.string().trim().max(100, "Use no more than 100 characters for the job title."),
})
export const customerSignUpSchema = customerProfileSchema.extend({
  email: z.string().trim().email("Enter a valid email address.").max(254).transform(value => value.toLowerCase()),
  password: z.string().min(12, "Use at least 12 characters for the password.").max(128, "Use no more than 128 characters for the password."),
})
export const customerSignInSchema = z.object({
  identifier: z.string().trim().min(1, "Enter the email address or username.").max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1, "Enter the password.").max(128),
})
export type CustomerProfileInput = z.infer<typeof customerProfileSchema>
export type CustomerSignUpInput = z.infer<typeof customerSignUpSchema>
export type CustomerSignInInput = z.infer<typeof customerSignInSchema>
