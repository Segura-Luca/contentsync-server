/** Rutas HTTP de propuestas de ideas (/api/v1/idea-proposals): el cliente propone y la agencia responde. */
import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { AuthenticatedUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AcceptIdeaProposalDto, CreateIdeaProposalDto } from './dto/idea-proposal.dto';
import { IdeaProposalsService } from './idea-proposals.service';

@ApiTags('Propuestas de ideas de los clientes')
@ApiBearerAuth('jwt-auth')
@Controller('idea-proposals')
export class IdeaProposalsController {
  constructor(private readonly proposalsService: IdeaProposalsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar propuestas: el cliente ve las suyas y la agencia las que recibió' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.proposalsService.list(user);
  }

  @Post()
  @Roles(RoleCode.CLIENTE)
  @ApiOperation({ summary: 'Proponerle una idea a la agencia (cliente)' })
  create(@Body() dto: CreateIdeaProposalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.proposalsService.create(dto, user);
  }

  @Post(':id/accept')
  @Roles(RoleCode.AGENCIA, RoleCode.ADMIN_GENERAL)
  @ApiOperation({ summary: 'Aceptar una propuesta, con o sin cambios: pasa a ser una idea de la agencia' })
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptIdeaProposalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.proposalsService.accept(id, dto, user);
  }

  @Post(':id/reject')
  @Roles(RoleCode.AGENCIA, RoleCode.ADMIN_GENERAL)
  @ApiOperation({ summary: 'Rechazar una propuesta' })
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.proposalsService.reject(id, user);
  }
}
