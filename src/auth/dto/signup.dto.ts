import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, MinLength, IsEnum, IsOptional, IsArray, Matches } from 'class-validator';

export class SignupDto {
  @ApiProperty({
    description: 'First name of the user.',
    example: 'John',
    minLength: 1,
  })
  @IsString()
  @MinLength(1, { message: 'First name is required.' })
  firstName: string;

  @ApiProperty({
    description: 'Last name of the user.',
    example: 'Doe',
    minLength: 1,
  })
  @IsString()
  @MinLength(1, { message: 'Last name is required.' })
  lastName: string;

  @ApiProperty({
    description: 'Email address of the user.',
    example: 'john.doe@example.com',
  })
  @IsEmail({}, { message: 'Invalid email format.' })
  email: string;

  @ApiProperty({
    description: 'Password for the user account.',
    example: 'Password123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+={}\[\]:;"\'<>,.?\/\\|-]).{8,}$/, {
    message: 'Password must include at least one letter, one number, and one special character.',
  })
  password: string;

  @ApiProperty({
    description: 'Confirm the password.',
    example: 'Password123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Confirm password is required.' })
  confirmPassword: string;

  @ApiProperty({
    description: 'Phone number of the user.',
    example: '+1234567890',
  })
  @Matches(/^\d{10,15}$/, { message: 'Check your number and try again. It must be 10-15 digits with no spaces or symbols.' })
  phone: string;

  @ApiProperty({
    description: 'Selected plan for the user.',
    enum: ['Free Plan', 'Bronze Plan', 'Bronze Plan', 'Gold Plan'],
    example: 'silver',
  })
  @IsEnum(['Free Plan', 'Bronze Plan', 'Silver Plan', 'Gold Plan'], { message: 'Invalid plan selected.' })
  plan: 'Free Plan' | 'Bronze Plan' | 'Silver Plan' | 'Gold Plan';

  @ApiProperty({
    description: 'Roles assigned to the user.',
    type: [String],
    example: ['admin', 'serviceProvider'],
    required: false,
  })
  @IsArray()
  @IsOptional()
  roles: string[];
}
