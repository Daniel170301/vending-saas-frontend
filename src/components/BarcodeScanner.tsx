import { useZxing } from "react-zxing";

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

export const BarcodeScanner = ({ onScanSuccess }: BarcodeScannerProps) => {
  const { ref } = useZxing({
    // Le agregamos ": any" al resultado para que TypeScript no marque error
    onDecodeResult(result: any) { 
      // Cuando detecta un código de barras o QR, envía el texto
      onScanSuccess(result.getText());
    },
    // Opcional: Si quieres ver errores en consola puedes descomentar la siguiente línea
    // onError(error) { console.error(error); }
  });

  return (
    <div className="w-full rounded-lg overflow-hidden border-2 border-emerald-500/20 bg-black flex justify-center">
      {/* React conectará la cámara directamente a esta etiqueta de video */}
      <video ref={ref} className="w-full max-h-[40vh] object-cover" />
    </div>
  );
};