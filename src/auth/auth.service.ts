import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EmpleadosService } from '../empleados/empleados.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly empleadosService: EmpleadosService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { documentoIdentidad, password } = loginDto;

    // Buscar empleado por Documento de Identidad incluyendo la contraseña en la consulta
    const empleado =
      await this.empleadosService.findByDocumentoIdentidadWithPassword(
        documentoIdentidad,
      );
    if (!empleado || !empleado.password) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const isPasswordValid = await bcrypt.compare(password, empleado.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const payload = {
      sub: empleado.id,
      tipoDocumento: empleado.tipoDocumento,
      documentoIdentidad: empleado.documentoIdentidad,
      email: empleado.email,
      rol: empleado.rol,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: empleado.id,
        nombre: empleado.nombre,
        email: empleado.email,
        rol: empleado.rol,
      },
    };
  }
}
