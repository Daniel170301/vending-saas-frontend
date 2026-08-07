import { useZxing } from "react-zxing";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import { useMemo } from "react";

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

export const BarcodeScanner = ({ onScanSuccess }: BarcodeScannerProps) => {
  // 1. Configuramos el escáner para que busque específicamente códigos de productos
  const hints = useMemo(() => {
    const hintsMap = new Map();
    hintsMap.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13, // Este es el formato exacto de tu botella
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
    ]);
    return hintsMap;
  }, []);

const { ref } = useZxing({
    hints,
    constraints: {
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    onDecodeResult(result: any) { 
      onScanSuccess(result.getText());
    },
  } as any); // <-- AÑADIMOS "as any" AQUÍ

  return (
    <div className="relative w-full rounded-lg overflow-hidden border-2 border-emerald-500/20 bg-black flex justify-center items-center">
      {/* Video de la cámara */}
      <video ref={ref} className="w-full max-h-[50vh] object-cover" />
      
      {/* Guía visual (Marco y Láser rojo) para ayudar a enfocar */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
        <div className="w-3/4 h-32 border-2 border-emerald-500/50 rounded-lg relative flex items-center justify-center bg-black/10">
           <div className="w-full h-[2px] bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)] animate-pulse"></div>
        </div>
        <p className="text-white/80 text-xs mt-4 bg-black/50 px-3 py-1 rounded-full">
          Alinea el código con la línea roja
        </p>
      </div>
    </div>
  );
};