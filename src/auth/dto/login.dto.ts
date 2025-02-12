import { IsEmail, IsString, MinLength, Matches } from 'class-validator';  // Importing validation decorators
import { ApiProperty } from '@nestjs/swagger';  // Importing Swagger decorator for better API documentation

export class LoginDto {
  @ApiProperty({
    description: 'The email address of the user.',
    example: 'john.doe@example.com',
    type: String,
  })
  @IsEmail({}, { message: 'Invalid email format.' })  // Ensures the email is in correct format
  email: string;

  @ApiProperty({
    description: 'The password for user authentication.',
    example: 'Password123!',
    minLength: 8,
    type: String,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })  // Ensures the password has a minimum length
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+={}\[\]:;"\'<>,.?\/\\|-]).{8,}$/, {
    message: 'Password must include at least one letter, one number, and one special character.',
  })  // Strong password pattern
  password: string;
}
