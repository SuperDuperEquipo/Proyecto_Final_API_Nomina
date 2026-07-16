import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CreateEmpleadoDto } from '../empleados/dto/create-empleado.dto';
import { LoginDto } from './dto/login.dto';
import { EmpleadoRole } from '../empleados/entities/empleado.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let service: any;

  const mockAuthService = {
    login: jest.fn(),
    register: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register and return the registered employee info', async () => {
      const dto: CreateEmpleadoDto = {
        nombre: 'Administrador del Sistema',
        dui: '00000000-0',
        email: 'admin@nomina.com',
        password: 'adminPassword123',
        salarioBase: 2000,
        cargo: 'Administrador',
        area: 'Sistemas',
        fechaIngreso: new Date().toISOString().split('T')[0],
        afp: 'AFP Crecer',
        rol: EmpleadoRole.ADMIN,
      };

      const expectedResult = {
        id: 1,
        nombre: dto.nombre,
        dui: dto.dui,
        email: dto.email,
        salarioBase: dto.salarioBase,
        cargo: dto.cargo,
        area: dto.area,
        fechaIngreso: new Date(dto.fechaIngreso),
        afp: dto.afp,
        rol: EmpleadoRole.ADMIN,
      };

      service.register.mockResolvedValue(expectedResult);

      const result = await controller.register(dto);

      expect(service.register).toHaveBeenCalledWith(dto);
      expect(result).toBe(expectedResult);
    });
  });

  describe('login', () => {
    it('should call authService.login and return token and user info', async () => {
      const dto: LoginDto = {
        email: 'admin@nomina.com',
        password: 'adminPassword123',
      };

      const expectedResult = {
        access_token: 'signed-jwt-token',
        user: {
          id: 1,
          nombre: 'Administrador del Sistema',
          email: dto.email,
          rol: EmpleadoRole.ADMIN,
        },
      };

      service.login.mockResolvedValue(expectedResult);

      const result = await controller.login(dto);

      expect(service.login).toHaveBeenCalledWith(dto);
      expect(result).toBe(expectedResult);
    });
  });
});
