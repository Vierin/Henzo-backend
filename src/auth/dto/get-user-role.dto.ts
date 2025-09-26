import { IsString } from 'class-validator';

export class GetUserRoleDto {
	@IsString()
	userId: string;
}
