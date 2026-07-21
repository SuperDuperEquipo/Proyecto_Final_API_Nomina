import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { EmpleadosService } from '../empleados/empleados.service';
import { JwtService } from '@nestjs/jwt';
import { EmpleadoRole } from '../empleados/entities/empleado.entity';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let empleadosService: any;
  let jwtService: any;

  const mockEmpleadosService = {
    findAll: jest.fn(),
    create: jest.fn(),
    findByEmailWithPassword: jest.fn(),
    findByDocumentoIdentidadWithPassword: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: EmpleadosService,
          useValue: mockEmpleadosService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    empleadosService = module.get<EmpleadosService>(EmpleadosService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should force rol ADMIN when registering the first employee', async () => {
      const dto: any = {
        nombre: 'Administrador del Sistema',
        tipoDocumento: 'DUI',
        documentoIdentidad: '00000000-0',
        email: 'admin@nomina.com',
        password: 'adminPassword123',
        salarioBase: 2000,
        cargo: 'Administrador',
        area: 'Sistemas',
        fechaIngreso: new Date().toISOString().split('T')[0],
        afp: 'AFP Crecer',
        rol: EmpleadoRole.EMPLEADO,
      };

      empleadosService.findAll.mockResolvedValue([]);
      empleadosService.create.mockImplementation((data) =>
        Promise.resolve({ id: 1, ...data }),
      );

      const result = await service.register(dto);

      expect(empleadosService.findAll).toHaveBeenCalledTimes(1);
      expect(dto.rol).toBe(EmpleadoRole.ADMIN);
      expect(empleadosService.create).toHaveBeenCalledWith(dto);
      expect(result.id).toBe(1);
    });

    it('should keep the provided rol when there are already employees registered', async () => {
      const dto: any = {
        nombre: 'Juan Pérez',
        tipoDocumento: 'DUI',
        documentoIdentidad: '00000001-2',
        email: 'juan@nomina.com',
        password: 'password123',
        salarioBase: 850,
        cargo: 'Auxiliar',
        area: 'Finanzas',
        fechaIngreso: '2026-07-15',
        afp: 'AFP Confía',
        rol: EmpleadoRole.EMPLEADO,
      };

      empleadosService.findAll.mockResolvedValue([{ id: 1, nombre: 'Admin' }]);
      empleadosService.create.mockImplementation((data) =>
        Promise.resolve({ id: 2, ...data }),
      );

      const result = await service.register(dto);

      expect(empleadosService.findAll).toHaveBeenCalledTimes(1);
      expect(dto.rol).toBe(EmpleadoRole.EMPLEADO);
      expect(empleadosService.create).toHaveBeenCalledWith(dto);
      expect(result.id).toBe(2);
    });

    it('should throw ConflictException if password is not provided', async () => {
      const dto: any = {
        nombre: 'Juan Pérez',
        tipoDocumento: 'DUI',
        documentoIdentidad: '00000001-2',
        email: 'juan@nomina.com',
        salarioBase: 850,
        cargo: 'Auxiliar',
        area: 'Finanzas',
        fechaIngreso: '2026-07-15',
        afp: 'AFP Confía',
      };

      empleadosService.findAll.mockResolvedValue([]);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const loginDto = {
      documentoIdentidad: '00000000-0',
      password: 'adminPassword123',
    };

    it('should throw UnauthorizedException if employee is not found', async () => {
      empleadosService.findByDocumentoIdentidadWithPassword.mockResolvedValue(
        null,
      );

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if employee has no password set', async () => {
      empleadosService.findByDocumentoIdentidadWithPassword.mockResolvedValue({
        id: 1,
        tipoDocumento: 'DUI',
        documentoIdentidad: '00000000-0',
        email: 'admin@nomina.com',
        password: null,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password comparison fails', async () => {
      empleadosService.findByDocumentoIdentidadWithPassword.mockResolvedValue({
        id: 1,
        tipoDocumento: 'DUI',
        documentoIdentidad: '00000000-0',
        email: 'admin@nomina.com',
        password: 'hashed_password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return access token and user info if password is valid', async () => {
      const user = {
        id: 1,
        nombre: 'Administrador del Sistema',
        tipoDocumento: 'DUI',
        documentoIdentidad: '00000000-0',
        email: 'admin@nomina.com',
        password: 'hashed_password',
        rol: EmpleadoRole.ADMIN,
      };

      empleadosService.findByDocumentoIdentidadWithPassword.mockResolvedValue(
        user,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue('jwt-token-xyz');

      const result = await service.login(loginDto);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: user.id,
        tipoDocumento: user.tipoDocumento,
        documentoIdentidad: user.documentoIdentidad,
        email: user.email,
        rol: user.rol,
      });
      expect(result).toEqual({
        access_token: 'jwt-token-xyz',
        user: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          rol: user.rol,
        },
      });
    });
  });
});
