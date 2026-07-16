import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { EmpleadosService } from '../../empleados/empleados.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly empleadosService: EmpleadosService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'super_secreto_para_jwt_equipo_nomina'),
    });
  }

  async validate(payload: any) {
    const { sub: id } = payload;
    const empleado = await this.empleadosService.findOne(+id);
    if (!empleado) {
      throw new UnauthorizedException('Token inválido o el usuario ya no existe.');
    }
    return empleado; // Se inyecta en req.user
  }
}
