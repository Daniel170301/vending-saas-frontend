import { useZxing } from "react-zxing";

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

export const BarcodeScanner = ({ onScanSuccess }: BarcodeScannerProps) => {
  const { ref } = useZxing({
    onDecodeResult(result: any) { 
      onScanSuccess(result.getText());
    },
  });

  return (
    <div className="w-full rounded-lg overflow-hidden border-2 border-emerald-500/20 bg-black flex justify-center">
      <video ref={ref} className="w-full max-h-[40vh] object-cover" />
    </div>
  );
};