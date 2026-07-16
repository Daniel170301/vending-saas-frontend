import { useEffect, useState } from "react";

// Definimos la estructura de los datos de tu usuario (basada en tu tabla de PostgreSQL)
interface CustomUser {
  id: number | string;
  email: string;
  nombre: string;
  rol: string;
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Buscamos el token y los datos del usuario en la memoria del navegador
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        // Convertimos el texto guardado nuevamente en un objeto de JavaScript
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Error al leer el usuario guardado");
      }
    }
    
    // 2. Avisamos que ya terminamos de cargar
    setLoading(false);
  }, []);

  // 3. Función para cerrar sesión y borrar los accesos
  const signOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    window.location.href = "/"; // Redirigimos al Login
  };

  // Devolvemos "session" como un alias del token para no romper el resto de tus pantallas
  return { session: token, user, loading, signOut };
}