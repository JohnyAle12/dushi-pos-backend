/** Usuario inyectado por JwtStrategy tras validar el token */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  storeId: string;
  role: string;
}
