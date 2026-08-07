import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

export const BarcodeScanner = ({ onScanSuccess }: BarcodeScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    const startNativeScanner = async () => {
      // 1. Verificamos si el celular tiene el motor nativo de Inteligencia Artificial
      if (!('BarcodeDetector' in window)) {
        setError("Tu navegador actual no soporta el escáner nativo ultra-rápido. Te recomendamos usar Google Chrome en Android.");
        return;
      }

      try {
        // 2. Encendemos la cámara trasera en alta definición
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          // 3. Inicializamos el escáner nativo del teléfono
          // (Usamos @ts-ignore porque TypeScript a veces no reconoce funciones tan modernas)
          // @ts-ignore
          const barcodeDetector = new BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
          });

          // 4. Bucle de lectura ultra-rápido a 60fps
          const detect = async () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  // ¡Código detectado! Apagamos la cámara y enviamos el texto
                  onScanSuccess(barcodes[0].rawValue);
                  return; 
                }
              } catch (e) {
                console.error("Error leyendo:", e);
              }
            }
            // Si no lee nada en este milisegundo, vuelve a intentar en el siguiente
            animationFrameId = requestAnimationFrame(detect);
          };

          detect();
        }
      } catch (err) {
        setError("Error al acceder a la cámara. Revisa los permisos.");
      }
    };

    startNativeScanner();

    // 5. Apagamos la cámara limpiamente cuando se cierra la ventana
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onScanSuccess]);

  if (error) {
    return <div className="p-4 bg-red-100 text-red-700 text-center rounded-lg">{error}</div>;
  }

  return (
    <div className="relative w-full rounded-lg overflow-hidden border-2 border-emerald-500/20 bg-black flex justify-center items-center">
      {/* playsInline y muted son vitales para que la cámara no se vuelva loca en móviles */}
      <video ref={videoRef} className="w-full max-h-[50vh] object-cover" playsInline muted />
      
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
        <div className="w-3/4 h-32 border-2 border-emerald-500/50 rounded-lg relative flex items-center justify-center bg-black/10">
           <div className="w-full h-[2px] bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)] animate-pulse"></div>
        </div>
        <p className="text-white/90 text-xs mt-4 bg-emerald-700/80 px-3 py-1 rounded-full text-center font-bold">
          Escáner Nativo Activado ⚡
        </p>
      </div>
    </div>
  );
};