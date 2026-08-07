import { useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

export const BarcodeScanner = ({ onScanSuccess }: BarcodeScannerProps) => {
  useEffect(() => {
    // Configuramos el escáner: 10 frames por segundo y un cuadro de lectura de 250x250px
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 150 } },
      false // false para no mostrar logs molestos en la consola
    );

    // Renderizamos la cámara y le pasamos qué hacer si tiene éxito o si falla
    scanner.render(
      (decodedText) => {
        // Cuando lee el código, detenemos la cámara y pasamos el texto
        scanner.clear();
        onScanSuccess(decodedText);
      },
      (error) => {
        // Los errores de lectura (cuando la cámara no ve un código claro) son constantes,
        // por lo que los ignoramos en silencio para no saturar la aplicación.
      }
    );

    // Limpiamos la cámara si el usuario cierra la ventana antes de escanear
    return () => {
      scanner.clear().catch(error => console.error("Error al limpiar el escáner", error));
    };
  }, [onScanSuccess]);

  return (
    <div className="w-full">
      <div id="reader" className="w-full rounded-lg overflow-hidden border-2 border-primary/20"></div>
    </div>
  );
};