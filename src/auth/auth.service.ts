import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EmpleadosService } from '../empleados/empleados.service';
import { LoginDto } from './dto/login.dto';
import { CreateEmpleadoDto } from '../empleados/dto/create-empleado.dto';
import { EmpleadoRole } from '../empleados/entities/empleado.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly empleadosService: EmpleadosService,
    private readonly jwtService: JwtService,
  ) {}

  async register(createEmpleadoDto: CreateEmpleadoDto) {
    // Buscar si ya existen empleados en el sistema.
    // Si no existen empleados, obligar a que el primero sea ADMIN para bootstrapear la seguridad.
    const allEmployees = await this.empleadosService.findAll();
    if (allEmployees.length === 0) {
      createEmpleadoDto.rol = EmpleadoRole.ADMIN;
    }

    if (!createEmpleadoDto.password) {
      throw new ConflictException(
        'Se requiere una contraseña para el registro de usuario.',
      );
    }

    return this.empleadosService.create(createEmpleadoDto);
  }

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
