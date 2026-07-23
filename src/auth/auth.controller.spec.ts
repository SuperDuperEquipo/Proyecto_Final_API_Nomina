import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { EmpleadoRole } from '../empleados/entities/empleado.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let service: any;

  const mockAuthService = {
    login: jest.fn(),
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

  describe('login', () => {
    it('should call authService.login and return token and user info', async () => {
      const dto: LoginDto = {
        documentoIdentidad: '00000000-0',
        password: 'adminPassword123',
      };

      const expectedResult = {
        access_token: 'signed-jwt-token',
        user: {
          id: 1,
          nombre: 'Administrador del Sistema',
          email: 'admin@nomina.com',
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
