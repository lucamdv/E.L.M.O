import { AmbientProvider } from "@/components/ambient/ambient-provider";
import { LucaOSExperience } from "@/components/luca-os-experience";

export default function Home() {
  return (
    <AmbientProvider>
      <LucaOSExperience />
    </AmbientProvider>
  );
}
