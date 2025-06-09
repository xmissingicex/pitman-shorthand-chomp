import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface Position {
  x: number;
  y: number;
}

interface Ghost {
  x: number;
  y: number;
  direction: string;
  color: string;
  mode: 'chase' | 'scatter' | 'frightened';
  frightenedTime: number;
}

const CELL_SIZE = 20;
const ROWS = 21;
const COLS = 25;

// Simplified maze layout (1 = wall, 0 = dot, 2 = power pellet, 3 = empty)
const MAZE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,2,1,1,1,0,1,1,1,1,1,0,1,0,1,1,1,1,1,0,1,1,1,2,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,0,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1],
  [1,1,1,1,1,0,1,1,1,1,1,3,1,3,1,1,1,1,1,0,1,1,1,1,1],
  [1,1,1,1,1,0,1,3,3,3,3,3,3,3,3,3,3,3,1,0,1,1,1,1,1],
  [1,1,1,1,1,0,1,3,1,1,3,3,3,3,3,1,1,3,1,0,1,1,1,1,1],
  [0,0,0,0,0,0,3,3,1,3,3,3,3,3,3,3,1,3,3,0,0,0,0,0,0],
  [1,1,1,1,1,0,1,3,1,3,3,3,3,3,3,3,1,3,1,0,1,1,1,1,1],
  [1,1,1,1,1,0,1,3,1,1,1,1,1,1,1,1,1,3,1,0,1,1,1,1,1],
  [1,1,1,1,1,0,1,3,3,3,3,3,3,3,3,3,3,3,1,0,1,1,1,1,1],
  [1,1,1,1,1,0,1,1,1,1,1,3,1,3,1,1,1,1,1,1,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,1,1,1,1,0,1,0,1,1,1,1,1,0,1,1,1,0,1],
  [1,2,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,2,1],
  [1,1,1,0,1,0,1,0,1,1,1,1,1,1,1,1,1,0,1,0,1,0,1,1,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1],
  [1,0,1,1,1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1,1,1,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

export const PitmanPacManGame = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'playing' | 'paused' | 'gameOver' | 'waiting'>('waiting');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  
  const [player, setPlayer] = useState<Position>({ x: 12, y: 15 });
  const [ghosts, setGhosts] = useState<Ghost[]>([
    { x: 12, y: 9, direction: 'up', color: '#ff0000', mode: 'chase', frightenedTime: 0 },
    { x: 11, y: 9, direction: 'up', color: '#ffb8ff', mode: 'chase', frightenedTime: 0 },
    { x: 13, y: 9, direction: 'up', color: '#00ffff', mode: 'chase', frightenedTime: 0 },
    { x: 12, y: 10, direction: 'up', color: '#ea7024', mode: 'chase', frightenedTime: 0 }
  ]);
  
  const [maze, setMaze] = useState(() => MAZE.map(row => [...row]));
  const [powerMode, setPowerMode] = useState(false);
  const [powerModeTime, setPowerModeTime] = useState(0);

  const gameLoopRef = useRef<number>();
  const keysRef = useRef<Set<string>>(new Set());

  const drawSirIsaacPitman = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, direction: string = 'right') => {
    const centerX = x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = y * CELL_SIZE + CELL_SIZE / 2;
    const size = CELL_SIZE * 2.5; // MASSIVE size for hyper-realistic detail

    // Save context for complex rendering
    ctx.save();

    // Create highly detailed skin gradient matching the reference
    const skinGradient = ctx.createRadialGradient(
      centerX - size * 0.15, centerY - size * 0.2, 0,
      centerX, centerY, size * 0.8
    );
    skinGradient.addColorStop(0, '#fce4d6'); // Highlight
    skinGradient.addColorStop(0.3, '#f5d5c4'); // Mid-tone
    skinGradient.addColorStop(0.7, '#e8c1a8'); // Shadow
    skinGradient.addColorStop(1, '#d4a78a'); // Deep shadow

    // Main face shape - oval for realism
    ctx.fillStyle = skinGradient;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, size * 0.8, size * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Forehead with realistic aging lines
    ctx.strokeStyle = 'rgba(212, 167, 138, 0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(centerX - size * 0.5, centerY - size * (0.7 + i * 0.08));
      ctx.quadraticCurveTo(centerX, centerY - size * (0.75 + i * 0.08), centerX + size * 0.5, centerY - size * (0.7 + i * 0.08));
      ctx.stroke();
    }

    // Hyper-realistic wire-rim glasses exactly like the reference
    ctx.strokeStyle = '#8B4513'; // Brown/gold frame
    ctx.lineWidth = 2;
    
    const lensRadius = size * 0.18;
    const lensY = centerY - size * 0.25;
    
    // Left lens
    ctx.beginPath();
    ctx.arc(centerX - size * 0.28, lensY, lensRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Right lens  
    ctx.beginPath();
    ctx.arc(centerX + size * 0.28, lensY, lensRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Nose bridge
    ctx.beginPath();
    ctx.moveTo(centerX - size * 0.1, lensY);
    ctx.lineTo(centerX + size * 0.1, lensY);
    ctx.stroke();
    
    // Realistic temple arms
    ctx.beginPath();
    ctx.moveTo(centerX - size * 0.46, lensY);
    ctx.quadraticCurveTo(centerX - size * 0.7, lensY - size * 0.1, centerX - size * 0.8, centerY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(centerX + size * 0.46, lensY);
    ctx.quadraticCurveTo(centerX + size * 0.7, lensY - size * 0.1, centerX + size * 0.8, centerY);
    ctx.stroke();

    // Lens reflections for ultra-realism
    const leftLensGradient = ctx.createLinearGradient(
      centerX - size * 0.4, lensY - size * 0.15,
      centerX - size * 0.16, lensY + size * 0.05
    );
    leftLensGradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    leftLensGradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
    ctx.fillStyle = leftLensGradient;
    ctx.beginPath();
    ctx.arc(centerX - size * 0.28, lensY, lensRadius * 0.8, 0, Math.PI * 2);
    ctx.fill();
    
    const rightLensGradient = ctx.createLinearGradient(
      centerX + size * 0.16, lensY - size * 0.15,
      centerX + size * 0.4, lensY + size * 0.05
    );
    rightLensGradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    rightLensGradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
    ctx.fillStyle = rightLensGradient;
    ctx.beginPath();
    ctx.arc(centerX + size * 0.28, lensY, lensRadius * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Hyper-realistic eyes behind glasses
    const eyeSize = size * 0.06;
    
    // Left eye complex structure
    const leftEyeX = centerX - size * 0.28;
    const leftEyeY = lensY;
    
    // Eye socket shadow
    const socketGradient = ctx.createRadialGradient(leftEyeX, leftEyeY, 0, leftEyeX, leftEyeY, eyeSize * 2);
    socketGradient.addColorStop(0, 'rgba(212, 167, 138, 0.1)');
    socketGradient.addColorStop(1, 'rgba(180, 140, 120, 0.3)');
    ctx.fillStyle = socketGradient;
    ctx.beginPath();
    ctx.ellipse(leftEyeX, leftEyeY, eyeSize * 1.5, eyeSize * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye white
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(leftEyeX, leftEyeY, eyeSize, eyeSize * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Iris - hazel/brown like in reference
    const irisGradient = ctx.createRadialGradient(leftEyeX, leftEyeY, 0, leftEyeX, leftEyeY, eyeSize * 0.7);
    irisGradient.addColorStop(0, '#8B7355');
    irisGradient.addColorStop(0.4, '#654321');
    irisGradient.addColorStop(0.8, '#3E2723');
    irisGradient.addColorStop(1, '#2E1B13');
    ctx.fillStyle = irisGradient;
    ctx.beginPath();
    ctx.arc(leftEyeX, leftEyeY, eyeSize * 0.6, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(leftEyeX, leftEyeY, eyeSize * 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(leftEyeX - eyeSize * 0.2, leftEyeY - eyeSize * 0.2, eyeSize * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Right eye (mirror left eye)
    const rightEyeX = centerX + size * 0.28;
    const rightEyeY = lensY;
    
    // Eye socket shadow
    ctx.fillStyle = socketGradient;
    ctx.beginPath();
    ctx.ellipse(rightEyeX, rightEyeY, eyeSize * 1.5, eyeSize * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye white
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(rightEyeX, rightEyeY, eyeSize, eyeSize * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Iris
    ctx.fillStyle = irisGradient;
    ctx.beginPath();
    ctx.arc(rightEyeX, rightEyeY, eyeSize * 0.6, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(rightEyeX, rightEyeY, eyeSize * 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(rightEyeX + eyeSize * 0.2, rightEyeY - eyeSize * 0.2, eyeSize * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Ultra-realistic white hair matching reference images
    const hairGradient = ctx.createRadialGradient(
      centerX, centerY - size * 0.6, 0,
      centerX, centerY - size * 0.6, size * 0.8
    );
    hairGradient.addColorStop(0, '#ffffff');
    hairGradient.addColorStop(0.4, '#f8f8f8');
    hairGradient.addColorStop(0.7, '#f0f0f0');
    hairGradient.addColorStop(1, '#e8e8e8');
    
    // Side hair clusters - wispy and realistic
    ctx.fillStyle = hairGradient;
    for (let i = 0; i < 8; i++) {
      const hairX = centerX - size * (0.5 + i * 0.08);
      const hairY = centerY - size * (0.4 + i * 0.03);
      const hairSize = size * (0.12 + i * 0.01);
      ctx.beginPath();
      ctx.ellipse(hairX, hairY, hairSize, hairSize * 1.5, Math.PI * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Right side hair (mirrored)
    for (let i = 0; i < 8; i++) {
      const hairX = centerX + size * (0.5 + i * 0.08);
      const hairY = centerY - size * (0.4 + i * 0.03);
      const hairSize = size * (0.12 + i * 0.01);
      ctx.beginPath();
      ctx.ellipse(hairX, hairY, hairSize, hairSize * 1.5, -Math.PI * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // MASSIVE realistic white beard exactly like reference
    const beardGradient = ctx.createRadialGradient(
      centerX, centerY + size * 0.3, 0,
      centerX, centerY + size * 0.8, size * 1.4
    );
    beardGradient.addColorStop(0, '#ffffff');
    beardGradient.addColorStop(0.2, '#f8f8f8');
    beardGradient.addColorStop(0.5, '#f0f0f0');
    beardGradient.addColorStop(0.8, '#e8e8e8');
    beardGradient.addColorStop(1, '#dcdcdc');
    
    // Main beard shape - full and voluminous
    ctx.fillStyle = beardGradient;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + size * 0.6, size * 1.2, size * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Beard texture layers for ultra-realism
    for (let layer = 0; layer < 12; layer++) {
      const layerAlpha = 0.4 - layer * 0.02;
      const layerSize = 1.1 - layer * 0.06;
      ctx.fillStyle = `rgba(248, 248, 248, ${layerAlpha})`;
      ctx.beginPath();
      ctx.ellipse(
        centerX + (layer % 3 === 0 ? -size * 0.05 : layer % 3 === 1 ? size * 0.05 : 0), 
        centerY + size * (0.6 + layer * 0.015), 
        size * layerSize, 
        size * (layerSize - 0.05), 
        0, 0, Math.PI * 2
      );
      ctx.fill();
    }

    // Individual beard hair strands for photo-realism
    ctx.strokeStyle = 'rgba(240, 240, 240, 0.6)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 50; i++) {
      const angle = (Math.PI * 2 * i) / 50;
      const startRadius = size * 0.3;
      const endRadius = size * 1.3;
      const startX = centerX + Math.cos(angle) * startRadius;
      const startY = centerY + size * 0.2 + Math.sin(angle) * startRadius * 0.4;
      const endX = centerX + Math.cos(angle) * endRadius;
      const endY = centerY + size * 0.2 + Math.sin(angle) * endRadius * 0.9;
      
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(
        centerX + Math.cos(angle) * ((startRadius + endRadius) / 2) + (Math.random() - 0.5) * size * 0.1,
        centerY + size * 0.4 + (Math.random() - 0.5) * size * 0.05,
        endX, endY
      );
      ctx.stroke();
    }

    // Realistic nose with proper shading
    const noseGradient = ctx.createLinearGradient(
      centerX - size * 0.04, centerY - size * 0.05,
      centerX + size * 0.04, centerY + size * 0.08
    );
    noseGradient.addColorStop(0, '#f5d5c4');
    noseGradient.addColorStop(0.5, '#e8c1a8');
    noseGradient.addColorStop(1, '#d4a78a');
    ctx.fillStyle = noseGradient;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - size * 0.02, size * 0.05, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nostril details
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(centerX - size * 0.015, centerY + size * 0.01, size * 0.008, size * 0.012, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(centerX + size * 0.015, centerY + size * 0.01, size * 0.008, size * 0.012, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth opening for Pac-Man eating action
    const mouthSize = size * 0.3;
    if (direction === 'right') {
      ctx.fillStyle = '#2c2c2c';
      ctx.beginPath();
      ctx.arc(centerX + size * 0.2, centerY + size * 0.15, mouthSize, -0.3, 0.3);
      ctx.lineTo(centerX + size * 0.2, centerY + size * 0.15);
      ctx.fill();
    } else if (direction === 'left') {
      ctx.fillStyle = '#2c2c2c';
      ctx.beginPath();
      ctx.arc(centerX - size * 0.2, centerY + size * 0.15, mouthSize, Math.PI - 0.3, Math.PI + 0.3);
      ctx.lineTo(centerX - size * 0.2, centerY + size * 0.15);
      ctx.fill();
    } else if (direction === 'up') {
      ctx.fillStyle = '#2c2c2c';
      ctx.beginPath();
      ctx.arc(centerX, centerY - size * 0.05, mouthSize * 0.7, Math.PI * 1.3, Math.PI * 1.7);
      ctx.lineTo(centerX, centerY - size * 0.05);
      ctx.fill();
    } else if (direction === 'down') {
      ctx.fillStyle = '#2c2c2c';
      ctx.beginPath();
      ctx.arc(centerX, centerY + size * 0.25, mouthSize * 0.7, Math.PI * 0.3, Math.PI * 0.7);
      ctx.lineTo(centerX, centerY + size * 0.25);
      ctx.fill();
    }

    // Age lines and facial contours for ultra-realism
    ctx.strokeStyle = 'rgba(212, 167, 138, 0.3)';
    ctx.lineWidth = 0.8;
    
    // Nasolabial folds
    ctx.beginPath();
    ctx.moveTo(centerX - size * 0.02, centerY + size * 0.05);
    ctx.quadraticCurveTo(centerX - size * 0.15, centerY + size * 0.2, centerX - size * 0.25, centerY + size * 0.3);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(centerX + size * 0.02, centerY + size * 0.05);
    ctx.quadraticCurveTo(centerX + size * 0.15, centerY + size * 0.2, centerX + size * 0.25, centerY + size * 0.3);
    ctx.stroke();
    
    // Crow's feet
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(centerX - size * (0.46 + i * 0.03), lensY - size * (0.05 + i * 0.02));
      ctx.lineTo(centerX - size * (0.52 + i * 0.03), lensY - size * (0.08 + i * 0.02));
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(centerX + size * (0.46 + i * 0.03), lensY - size * (0.05 + i * 0.02));
      ctx.lineTo(centerX + size * (0.52 + i * 0.03), lensY - size * (0.08 + i * 0.02));
      ctx.stroke();
    }

    ctx.restore();
  }, []);

  const drawShorthandCharacter = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const centerX = x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = y * CELL_SIZE + CELL_SIZE / 2;
    
    ctx.strokeStyle = '#a9ca48';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    // Draw a simple shorthand stroke
    ctx.beginPath();
    ctx.moveTo(centerX - 3, centerY);
    ctx.quadraticCurveTo(centerX, centerY - 4, centerX + 3, centerY);
    ctx.stroke();
  }, []);

  const drawCertificate = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const centerX = x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = y * CELL_SIZE + CELL_SIZE / 2;
    
    // Certificate scroll
    ctx.fillStyle = '#f9f9f9';
    ctx.fillRect(centerX - 6, centerY - 4, 12, 8);
    
    ctx.strokeStyle = '#0d3b5d';
    ctx.lineWidth = 1;
    ctx.strokeRect(centerX - 6, centerY - 4, 12, 8);
    
    // Ribbon
    ctx.fillStyle = '#ea7024';
    ctx.fillRect(centerX - 2, centerY - 6, 4, 12);
  }, []);

  const drawGhost = useCallback((ctx: CanvasRenderingContext2D, ghost: Ghost) => {
    const centerX = ghost.x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = ghost.y * CELL_SIZE + CELL_SIZE / 2;
    const radius = CELL_SIZE * 0.4;

    // Ghost body
    ctx.fillStyle = ghost.mode === 'frightened' ? '#0000ff' : ghost.color;
    ctx.beginPath();
    ctx.arc(centerX, centerY - radius * 0.3, radius, 0, Math.PI);
    ctx.fillRect(centerX - radius, centerY - radius * 0.3, radius * 2, radius * 1.3);
    
    // Ghost bottom wavy part
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(centerX - radius + i * (radius * 0.5), centerY + radius);
      ctx.lineTo(centerX - radius + i * (radius * 0.5) + radius * 0.25, centerY + radius * 0.7);
      ctx.lineTo(centerX - radius + (i + 1) * (radius * 0.5), centerY + radius);
      ctx.fill();
    }

    // Eyes
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(centerX - radius * 0.3, centerY - radius * 0.2, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(centerX + radius * 0.3, centerY - radius * 0.2, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = ghost.mode === 'frightened' ? 'red' : 'black';
    ctx.beginPath();
    ctx.arc(centerX - radius * 0.3, centerY - radius * 0.2, radius * 0.1, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(centerX + radius * 0.3, centerY - radius * 0.2, radius * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const isValidMove = useCallback((x: number, y: number) => {
    if (x < 0) x = COLS - 1; // Wrap around left
    if (x >= COLS) x = 0; // Wrap around right
    if (y < 0 || y >= ROWS) return false;
    return maze[y][x] !== 1; // Not a wall
  }, [maze]);

  const movePlayer = useCallback((direction: string) => {
    setPlayer(prev => {
      let newX = prev.x;
      let newY = prev.y;

      switch (direction) {
        case 'ArrowUp': newY--; break;
        case 'ArrowDown': newY++; break;
        case 'ArrowLeft': newX--; break;
        case 'ArrowRight': newX++; break;
      }

      // Handle wrapping
      if (newX < 0) newX = COLS - 1;
      if (newX >= COLS) newX = 0;

      if (isValidMove(newX, newY)) {
        return { x: newX, y: newY };
      }
      return prev;
    });
  }, [isValidMove]);

  const collectItem = useCallback((x: number, y: number) => {
    const cellValue = maze[y][x];
    if (cellValue === 0) {
      // Collected shorthand character
      setMaze(prev => {
        const newMaze = prev.map(row => [...row]);
        newMaze[y][x] = 3; // Empty
        return newMaze;
      });
      setScore(prev => prev + 10);
    } else if (cellValue === 2) {
      // Collected certificate (power pellet)
      setMaze(prev => {
        const newMaze = prev.map(row => [...row]);
        newMaze[y][x] = 3; // Empty
        return newMaze;
      });
      setScore(prev => prev + 50);
      setPowerMode(true);
      setPowerModeTime(300); // 5 seconds at 60fps
      
      setGhosts(prev => prev.map(ghost => ({
        ...ghost,
        mode: 'frightened' as const,
        frightenedTime: 300
      })));
      
      toast.success("Certificate collected! Training boost activated!");
    }
  }, [maze]);

  const moveGhosts = useCallback(() => {
    setGhosts(prev => prev.map(ghost => {
      const directions = ['up', 'down', 'left', 'right'];
      const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' };
      
      let newX = ghost.x;
      let newY = ghost.y;
      
      // Simple AI: sometimes random, sometimes chase player
      let targetDirection = ghost.direction;
      
      if (Math.random() < 0.3) { // 30% chance to change direction
        const validDirections = directions.filter(dir => {
          let testX = ghost.x;
          let testY = ghost.y;
          
          switch (dir) {
            case 'up': testY--; break;
            case 'down': testY++; break;
            case 'left': testX--; break;
            case 'right': testX++; break;
          }
          
          return isValidMove(testX, testY) && dir !== opposites[ghost.direction];
        });
        
        if (validDirections.length > 0) {
          targetDirection = validDirections[Math.floor(Math.random() * validDirections.length)];
        }
      }
      
      switch (targetDirection) {
        case 'up': newY--; break;
        case 'down': newY++; break;
        case 'left': newX--; break;
        case 'right': newX++; break;
      }
      
      if (isValidMove(newX, newY)) {
        return {
          ...ghost,
          x: newX,
          y: newY,
          direction: targetDirection,
          frightenedTime: Math.max(0, ghost.frightenedTime - 1),
          mode: ghost.frightenedTime > 1 ? 'frightened' : 'chase'
        };
      }
      
      return ghost;
    }));
  }, [isValidMove]);

  const checkCollisions = useCallback(() => {
    // Check ghost collisions
    ghosts.forEach(ghost => {
      if (ghost.x === player.x && ghost.y === player.y) {
        if (ghost.mode === 'frightened') {
          // Eat the ghost
          setScore(prev => prev + 200);
          toast.success("Competitor defeated! +200 points");
        } else {
          // Player caught
          setLives(prev => {
            const newLives = prev - 1;
            if (newLives <= 0) {
              setGameState('gameOver');
              toast.error("Game Over! Time to restart your training journey.");
            } else {
              toast.error(`Training setback! ${newLives} chances left.`);
              // Reset player position
              setPlayer({ x: 12, y: 15 });
            }
            return newLives;
          });
        }
      }
    });

    // Check if all dots collected
    const hasDotsLeft = maze.some(row => row.some(cell => cell === 0 || cell === 2));
    if (!hasDotsLeft) {
      setLevel(prev => prev + 1);
      toast.success(`Level ${level} completed! Advanced training unlocked!`);
      // Reset maze with more dots
      setMaze(MAZE.map(row => [...row]));
      setPlayer({ x: 12, y: 15 });
    }
  }, [ghosts, player, maze, level]);

  const gameLoop = useCallback(() => {
    if (gameState !== 'playing') return;

    // Handle player movement
    if (keysRef.current.has('ArrowUp')) movePlayer('ArrowUp');
    if (keysRef.current.has('ArrowDown')) movePlayer('ArrowDown');
    if (keysRef.current.has('ArrowLeft')) movePlayer('ArrowLeft');
    if (keysRef.current.has('ArrowRight')) movePlayer('ArrowRight');

    // Collect items
    collectItem(player.x, player.y);

    // Move ghosts every few frames
    if (Math.random() < 0.3) {
      moveGhosts();
    }

    // Update power mode
    if (powerMode) {
      setPowerModeTime(prev => {
        if (prev <= 1) {
          setPowerMode(false);
          return 0;
        }
        return prev - 1;
      });
    }

    checkCollisions();
  }, [gameState, movePlayer, collectItem, moveGhosts, powerMode, checkCollisions, player.x, player.y]);

  // Game loop
  useEffect(() => {
    const interval = setInterval(gameLoop, 100);
    return () => clearInterval(interval);
  }, [gameLoop]);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        keysRef.current.add(e.key);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw maze
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = maze[y][x];
        
        if (cell === 1) {
          // Wall
          ctx.fillStyle = '#0d3b5d';
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        } else if (cell === 0) {
          // Shorthand character
          drawShorthandCharacter(ctx, x, y);
        } else if (cell === 2) {
          // Certificate
          drawCertificate(ctx, x, y);
        }
      }
    }

    // Draw player (Sir Isaac Pitman)
    drawSirIsaacPitman(ctx, player.x, player.y);

    // Draw ghosts
    ghosts.forEach(ghost => drawGhost(ctx, ghost));

    // Draw power mode indicator
    if (powerMode) {
      ctx.fillStyle = 'rgba(169, 202, 72, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [maze, player, ghosts, powerMode, drawSirIsaacPitman, drawShorthandCharacter, drawCertificate, drawGhost]);

  const startGame = () => {
    setGameState('playing');
    toast.success("Training quest started! Collect shorthand skills!");
  };

  const pauseGame = () => {
    setGameState(gameState === 'playing' ? 'paused' : 'playing');
  };

  const resetGame = () => {
    setGameState('waiting');
    setScore(0);
    setLives(3);
    setLevel(1);
    setPlayer({ x: 12, y: 15 });
    setMaze(MAZE.map(row => [...row]));
    setPowerMode(false);
    setPowerModeTime(0);
    setGhosts([
      { x: 12, y: 9, direction: 'up', color: '#ff0000', mode: 'chase', frightenedTime: 0 },
      { x: 11, y: 9, direction: 'up', color: '#ffb8ff', mode: 'chase', frightenedTime: 0 },
      { x: 13, y: 9, direction: 'up', color: '#00ffff', mode: 'chase', frightenedTime: 0 },
      { x: 12, y: 10, direction: 'up', color: '#ea7024', mode: 'chase', frightenedTime: 0 }
    ]);
    keysRef.current.clear();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Game Stats */}
      <div className="flex gap-8 text-white text-lg font-semibold">
        <div className="flex items-center gap-2">
          <span>Score:</span>
          <span className="text-[#a9ca48]">{score}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Lives:</span>
          <span className="text-[#ea7024]">{"❤️".repeat(lives)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Level:</span>
          <span className="text-blue-300">{level}</span>
        </div>
      </div>

      {/* Game Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={COLS * CELL_SIZE}
          height={ROWS * CELL_SIZE}
          className="border-2 border-[#0d3b5d] rounded-lg bg-black"
        />
        
        {gameState === 'waiting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded-lg">
            <div className="text-center text-white">
              <h3 className="text-2xl font-bold mb-4">Ready to Start Your Training?</h3>
              <p className="mb-4">Use arrow keys to move Sir Isaac Pitman</p>
              <Button onClick={startGame} className="bg-[#a9ca48] hover:bg-[#8db83a]">
                <Play className="w-4 h-4 mr-2" />
                Start Quest
              </Button>
            </div>
          </div>
        )}

        {gameState === 'paused' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded-lg">
            <div className="text-center text-white">
              <h3 className="text-2xl font-bold mb-4">Training Paused</h3>
              <Button onClick={pauseGame} className="bg-[#ea7024] hover:bg-[#d4601e]">
                <Play className="w-4 h-4 mr-2" />
                Resume
              </Button>
            </div>
          </div>
        )}

        {gameState === 'gameOver' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded-lg">
            <div className="text-center text-white">
              <h3 className="text-2xl font-bold mb-4">Training Complete!</h3>
              <p className="mb-4">Final Score: {score}</p>
              <p className="mb-4">Ready for your next career challenge?</p>
              <Button onClick={resetGame} className="bg-[#0d3b5d] hover:bg-[#0a2f4a]">
                <RotateCcw className="w-4 h-4 mr-2" />
                Start New Quest
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Game Controls */}
      <div className="flex gap-4">
        {gameState === 'playing' ? (
          <Button onClick={pauseGame} className="bg-[#ea7024] hover:bg-[#d4601e]">
            <Pause className="w-4 h-4 mr-2" />
            Pause
          </Button>
        ) : gameState === 'paused' ? (
          <Button onClick={pauseGame} className="bg-[#a9ca48] hover:bg-[#8db83a]">
            <Play className="w-4 h-4 mr-2" />
            Resume
          </Button>
        ) : null}
        
        <Button onClick={resetGame} variant="outline" className="border-white text-white hover:bg-white hover:text-[#0d3b5d]">
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
      </div>

      {/* Instructions */}
      <div className="text-center text-blue-200 text-sm max-w-2xl">
        <p className="mb-2">
          <strong>How to Play:</strong> Help Sir Isaac Pitman collect shorthand characters to build your skills! 
          Grab certificates for bonus points and training boosts. Avoid the competition (ghosts) - unless you have a training boost active!
        </p>
        <p>Use arrow keys to move around the training ground. Complete levels to unlock advanced training!</p>
      </div>
    </div>
  );
};
