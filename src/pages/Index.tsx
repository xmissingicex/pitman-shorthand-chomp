
import { PitmanPacManGame } from "@/components/PitmanPacManGame";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d3b5d] to-[#1a4d6b] p-4">
      <div className="container mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-2">
            Pitman Training Quest
          </h1>
          <p className="text-xl text-blue-200 mb-4">
            Help Sir Isaac Pitman collect shorthand skills for your dream career!
          </p>
          <div className="flex justify-center gap-4 text-sm text-blue-200">
            <span>🎯 Collect shorthand characters</span>
            <span>📜 Grab certificates for bonus points</span>
            <span>⚡ Avoid the competition!</span>
          </div>
        </div>
        <PitmanPacManGame />
      </div>
    </div>
  );
};

export default Index;
