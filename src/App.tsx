import React, { useEffect, useRef, useState } from 'react';

// =====================================================
// 1. CORE ENGINE CONFIGURATION & ASSET GENERATION
// =====================================================

let audioCtx: AudioContext | null = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(frequency: number, duration: number, volume = 0.1, type: OscillatorType = 'sine') {
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

const SFX = {
    collect: () => playTone(880, 0.1, 0.1, 'sine'),
    hit: () => playTone(70, 0.4, 0.4, 'sawtooth'),
    kraken: () => playTone(40, 1.2, 0.5, 'square'),
    dash: () => playTone(1200, 0.05, 0.03, 'sine'),
    upgrade: () => playTone(523, 0.3, 0.1, 'sine')
};

// Color Palette
const NEON_CYAN = 'rgb(0, 255, 255)';
const NEON_PURPLE = 'rgb(180, 0, 255)';
const DEEP_NAVY = 'rgb(2, 5, 15)';
const GOLD = 'rgb(255, 215, 0)';
const WHITE = 'rgb(255, 255, 255)';

// =====================================================
// 2. DATA PERSISTENCE & THE TRUTH DATABASE
// =====================================================
const TRUTHS = [
    "THE SURFACE IS A MEMORY.", "PRESSURE BUILDS CHARACTER.",
    "THE KRAKEN DOES NOT SLEEP, IT WAITS.", "PEARLS ARE THE TEARS OF THE ABYSS.",
    "LOGIC FAILS AT 10,000 METERS.", "SUCCESS IS THE ONLY WAY OUT."
];

class SaveSystem {
    data = {
        high_score: 0, 
        pearls: 0, 
        upgrades: {speed: 1.0, tank: 1.0, ink: 1.0}
    };
    constructor() {
        this.load();
    }
    load() {
        const saved = localStorage.getItem("oxine_master_save");
        if (saved) {
            try {
                this.data = JSON.parse(saved);
            } catch (e) {
                console.error("Failed to load save", e);
            }
        }
    }
    save() {
        localStorage.setItem("oxine_master_save", JSON.stringify(this.data));
    }
}

// =====================================================
// 3. VISUAL ENGINE (PARTICLES & LIGHTING)
// =====================================================
class Particle {
    x: number;
    y: number;
    color: string;
    vx: number;
    vy: number;
    life: number;

    constructor(x: number, y: number, color: string, vy = -2) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = vy + (Math.random() - 0.5) * 2;
        this.life = 255;
    }
    update() {
        this.x += this.vx; 
        this.y += this.vy; 
        this.life -= 5;
        return this.life > 0;
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / 255);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// =====================================================
// 4. PLAYER ENTITY (THE PROCEDURAL OCTOPUS)
// =====================================================
class Octopus {
    pos: {x: number, y: number};
    vel: {x: number, y: number};
    upgrades: any;
    oxygen: number;
    time: number;
    ink_cooldown: number;
    is_inked: boolean;

    constructor(upgrades: any, width: number, height: number) {
        this.pos = {x: width / 2, y: height / 2};
        this.vel = {x: 0, y: 0};
        this.upgrades = upgrades;
        this.oxygen = 100;
        this.time = 0;
        this.ink_cooldown = 0;
        this.is_inked = false;
    }

    update(keys: {[key: string]: boolean}, width: number, height: number) {
        const accel = 0.7 * this.upgrades.speed;
        if (keys['a'] || keys['ArrowLeft']) this.vel.x -= accel;
        if (keys['d'] || keys['ArrowRight']) this.vel.x += accel;
        if (keys['w'] || keys['ArrowUp']) this.vel.y -= accel;
        if (keys['s'] || keys['ArrowDown']) this.vel.y += accel;
        
        // Ink Dash Mechanic
        if (keys[' '] && this.ink_cooldown <= 0) {
            this.vel.x *= 4; 
            this.vel.y *= 4; 
            this.ink_cooldown = 120; 
            SFX.dash(); 
            this.is_inked = true;
        }
        
        if (this.ink_cooldown > 0) this.ink_cooldown -= 1;
        if (this.ink_cooldown < 90) this.is_inked = false;

        this.vel.x *= 0.94; // Drag
        this.vel.y *= 0.94;
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;
        
        this.pos.x = Math.max(40, Math.min(width - 40, this.pos.x));
        this.pos.y = Math.max(40, Math.min(height - 40, this.pos.y));
        
        this.oxygen -= 0.06 / this.upgrades.tank;
        this.time += 0.2;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const x = this.pos.x;
        const y = this.pos.y;
        
        // Draw 8 Procedural Tentacles
        ctx.fillStyle = 'rgb(200, 140, 0)';
        for (let i = 0; i < 8; i++) {
            const angle = (i * 45) + Math.sin(this.time + i) * 15;
            const rad = (angle + 90) * Math.PI / 180;
            // Segmented Tentacle logic for "Flow"
            for (let segment = 1; segment < 5; segment++) {
                const tx = x + Math.cos(rad) * (segment * 12) + Math.sin(this.time + segment) * 5;
                const ty = y + 20 + (segment * 10);
                ctx.beginPath();
                ctx.arc(tx, ty, 6 - segment, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Head (Body)
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.ellipse(x, y - 10, 25, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = WHITE;
        ctx.beginPath(); ctx.arc(x - 12, y - 5, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 12, y - 5, 6, 0, Math.PI * 2); ctx.fill();
        
        ctx.fillStyle = 'black';
        ctx.beginPath(); ctx.arc(x - 12, y - 5, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 12, y - 5, 3, 0, Math.PI * 2); ctx.fill();
    }
}

// =====================================================
// 5. PREDATORS & BOSS (AI)
// =====================================================
class Predator {
    type: string;
    pos: {x: number, y: number};
    speed: number;
    dir: number;
    rect: {x: number, y: number, w: number, h: number};

    constructor(width: number, height: number, ptype="SHARK") {
        this.type = ptype;
        const side = Math.random() < 0.5 ? -100 : width + 100;
        this.pos = {x: side, y: 100 + Math.random() * (height - 200)};
        this.speed = 3 + Math.random() * 3;
        this.dir = side < 0 ? 1 : -1;
        this.rect = {x: this.pos.x, y: this.pos.y, w: 80, h: 40};
    }

    update(width: number) {
        // Basic Steering Behavior
        if (this.type === "SHARK") {
            this.pos.x += this.speed * this.dir;
        }
        this.rect.x = this.pos.x;
        this.rect.y = this.pos.y;
        return this.pos.x > -300 && this.pos.x < width + 300;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = this.type === "SHARK" ? 'rgb(120, 130, 150)' : 'rgb(200, 50, 255)';
        ctx.beginPath();
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, 10);
        ctx.fill();
        
        // Eye
        const eye_x = this.dir === 1 ? this.rect.x + this.rect.w - 10 : this.rect.x + 10;
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(eye_x, this.rect.y + this.rect.h / 2, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Kraken {
    active: boolean;
    pos: {x: number, y: number};
    health: number;

    constructor(width: number) {
        this.active = false;
        this.pos = {x: width / 2, y: -400};
        this.health = 100;
    }
    spawn() {
        this.active = true; 
        SFX.kraken();
    }
    draw(ctx: CanvasRenderingContext2D) {
        if (!this.active) return;
        ctx.fillStyle = 'rgb(30, 0, 50)';
        ctx.beginPath();
        ctx.ellipse(this.pos.x, this.pos.y + 150, 300, 150, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'red';
        ctx.beginPath(); ctx.arc(this.pos.x - 100, this.pos.y + 150, 30, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.pos.x + 100, this.pos.y + 150, 30, 0, Math.PI * 2); ctx.fill();
    }
}

// =====================================================
// 6. MAIN GAME ENGINE
// =====================================================
class Engine {
    ss: SaveSystem;
    state: string;
    timer: number;
    width: number;
    height: number;
    
    player!: Octopus;
    enemies!: Predator[];
    orbs!: {x: number, y: number, w: number, h: number}[];
    particles!: Particle[];
    depth!: number;
    shake!: number;
    combo!: number;
    kraken!: Kraken;
    truth_msg!: string;
    truth_timer!: number;

    keys: {[key: string]: boolean} = {};

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.ss = new SaveSystem();
        this.state = "SPLASH";
        this.timer = 0;
        this.reset_game();
    }

    reset_game() {
        this.player = new Octopus(this.ss.data.upgrades, this.width, this.height);
        this.enemies = [];
        this.orbs = [];
        this.particles = [];
        this.depth = 0;
        this.shake = 0;
        this.combo = 1;
        this.kraken = new Kraken(this.width);
        this.truth_msg = ""; 
        this.truth_timer = 0;
    }

    handle_input(key: string) {
        if (this.state === "SPLASH") this.state = "MENU";
        else if (this.state === "MENU") {
            if (key === " ") this.state = "PLAYING";
            if (key.toLowerCase() === "s") this.state = "SHOP";
        }
        else if (this.state === "SHOP") {
            if (key === "1" && this.ss.data.pearls >= 10) {
                this.ss.data.upgrades.speed += 0.2;
                this.ss.data.pearls -= 10; 
                SFX.upgrade();
            }
            if (key === "2" && this.ss.data.pearls >= 15) {
                this.ss.data.upgrades.tank += 0.3;
                this.ss.data.pearls -= 15; 
                SFX.upgrade();
            }
            if (key.toLowerCase() === "m") this.state = "MENU";
        }
        else if (this.state === "GAMEOVER" && key.toLowerCase() === "r") {
            this.reset_game(); 
            this.state = "PLAYING";
        }
    }

    update() {
        if (this.state === "SPLASH") {
            this.timer += 1;
            if (this.timer > 180) this.state = "MENU";
        } else if (this.state === "PLAYING") {
            this.player.update(this.keys, this.width, this.height);
            this.depth += this.combo;
            if (this.shake > 0) this.shake -= 1;
            
            // Entity Spawning (Stephen's Logic)
            if (Math.random() < 1/45) this.enemies.push(new Predator(this.width, this.height));
            if (Math.random() < 1/30) {
                this.orbs.push({
                    x: 50 + Math.random() * (this.width - 100),
                    y: this.height + 20,
                    w: 20, h: 20
                });
            }
            if (this.depth > 10000 && !this.kraken.active) this.kraken.spawn();

            // Process AI & Physics
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                if (!e.update(this.width)) {
                    this.enemies.splice(i, 1);
                    continue;
                }
                const dx = this.player.pos.x - (e.rect.x + e.rect.w/2);
                const dy = this.player.pos.y - (e.rect.y + e.rect.h/2);
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (!this.player.is_inked && dist < 45) {
                    this.player.oxygen -= 5; 
                    this.shake = 20; 
                    SFX.hit();
                    this.enemies.splice(i, 1); 
                    this.combo = 1;
                }
            }

            for (let i = this.orbs.length - 1; i >= 0; i--) {
                const o = this.orbs[i];
                o.y -= 3;
                const dx = this.player.pos.x - (o.x + o.w/2);
                const dy = this.player.pos.y - (o.y + o.h/2);
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist < 35) {
                    this.player.oxygen = Math.min(100, this.player.oxygen + 15);
                    this.ss.data.pearls += 1; 
                    this.combo += 1;
                    SFX.collect();
                    this.orbs.splice(i, 1);
                    for (let j=0; j<10; j++) this.particles.push(new Particle(o.x + o.w/2, o.y + o.h/2, NEON_CYAN));
                    if (Math.random() < 0.25) {
                        this.truth_msg = TRUTHS[Math.floor(Math.random() * TRUTHS.length)]; 
                        this.truth_timer = 150;
                    }
                } else if (o.y < -50) {
                    this.orbs.splice(i, 1);
                }
            }

            if (this.player.oxygen <= 0) {
                this.state = "GAMEOVER";
                this.ss.data.high_score = Math.max(this.ss.data.high_score, this.depth);
                this.ss.save();
            }
        }
    }

    draw_hud(ctx: CanvasRenderingContext2D) {
        // Oxygen Bar
        ctx.fillStyle = 'rgb(80, 0, 0)';
        ctx.fillRect(30, 30, 200, 25);
        ctx.fillStyle = 'rgb(0, 255, 150)';
        ctx.fillRect(30, 30, Math.max(0, this.player.oxygen * 2), 25);
        
        // Depth & Pearls
        ctx.fillStyle = WHITE;
        ctx.font = '18px Consolas, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`DEPTH: ${Math.floor(this.depth/10)}m | PEARLS: ${this.ss.data.pearls}`, 30, 65);
        
        // Ink Cooldown
        const ik_c = this.player.ink_cooldown <= 0 ? NEON_PURPLE : 'rgb(50, 50, 50)';
        ctx.strokeStyle = ik_c;
        ctx.lineWidth = 4;
        ctx.beginPath();
        const endAngle = 2 * Math.PI * (1 - this.player.ink_cooldown/120);
        ctx.arc(50, 120, 20, 0, endAngle);
        ctx.stroke();
        
        // Radar (Success's Global Feature)
        ctx.strokeStyle = 'rgb(0, 30, 0)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.width - 130, this.height - 130, 110, 110);
        ctx.fillStyle = NEON_CYAN;
        for (const o of this.orbs) {
            const rx = this.width - 130 + (o.x / this.width * 110);
            const ry = this.height - 130 + (o.y / this.height * 110);
            ctx.beginPath();
            ctx.arc(rx, ry, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        const offX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 2 : 0;
        const offY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 2 : 0;
        
        const bg_color = Math.max(2, 20 - Math.floor(this.depth / 2000));
        ctx.fillStyle = `rgb(2, 4, ${bg_color})`;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.save();
        ctx.translate(offX, offY);
        ctx.textBaseline = 'top';

        if (this.state === "SPLASH") {
            ctx.textAlign = 'center';
            ctx.fillStyle = NEON_CYAN;
            ctx.font = 'bold 28px Verdana, sans-serif';
            ctx.fillText("CAMPFIRE HACK CLUB: ABEOKUTA WORKSHOP", this.width / 2, 380);
            
            ctx.fillStyle = WHITE;
            ctx.font = 'bold 50px Verdana, sans-serif';
            ctx.fillText("ABYSSAL ARCHITECTS", this.width / 2, 430);
        }
        else if (this.state === "MENU") {
            ctx.textAlign = 'center';
            ctx.fillStyle = GOLD;
            ctx.font = 'bold 50px Verdana, sans-serif';
            ctx.fillText("OXINE: SOVEREIGN", this.width / 2, 250);
            
            ctx.fillStyle = "#FFD700"; // GOLD
ctx.font = 'bold 24px Consolas, "Courier New", monospace';
ctx.fillText("BY: SOLE CREATOR & LEAD ARCHITECT: SUCCESS OLOYEDE", this.width / 2, 320);

// 2. COLLABORATION: Specific roles for Stephen and Sarah
ctx.fillStyle = 'rgba(200, 200, 200, 0.9)'; // Subtle Silver
ctx.font = '18px Consolas, monospace';
ctx.fillText("STEPHEN ADELAKUN | Systems Logic & Predator AI", this.width / 2, 360);
ctx.fillText("SARAH ADELAKUN | Narrative Design & 'The Truth' Lore", this.width / 2, 385);
            ctx.fillStyle = WHITE;
            ctx.font = 'bold 28px Verdana, sans-serif';
            ctx.fillText("PRESS SPACE TO DIVE", this.width / 2, 450);
            
            ctx.fillStyle = NEON_CYAN;
            ctx.font = '18px Consolas, monospace';
            ctx.fillText("PRESS [S] FOR BLACK MARKET SHOP", this.width / 2, 510);
        }
        else if (this.state === "SHOP") {
            ctx.fillStyle = 'rgb(10, 10, 20)';
            ctx.fillRect(-offX, -offY, this.width, this.height);
            
            ctx.textAlign = 'left';
            ctx.fillStyle = GOLD;
            ctx.font = 'bold 28px Verdana, sans-serif';
            ctx.fillText("THE BLACK MARKET", 100, 100);
            
            ctx.fillStyle = WHITE;
            ctx.font = '18px Consolas, monospace';
            ctx.fillText(`PEARLS AVAILABLE: ${this.ss.data.pearls}`, 100, 150);
            
            ctx.fillStyle = NEON_CYAN;
            ctx.fillText(`1. HYDRAULIC FINS (SPEED: ${this.player.upgrades.speed.toFixed(1)}) - 10P`, 100, 250);
            ctx.fillText(`2. REINFORCED TANK (O2: ${this.player.upgrades.tank.toFixed(1)}) - 15P`, 100, 300);
            
            ctx.fillStyle = WHITE;
            ctx.fillText("PRESS [M] FOR MENU", 100, 500);
        }
        else if (this.state === "PLAYING") {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                if (!p.update()) {
                    this.particles.splice(i, 1);
                } else {
                    p.draw(ctx);
                }
            }
            
            this.kraken.draw(ctx);
            for (const e of this.enemies) e.draw(ctx);
            
            ctx.strokeStyle = NEON_CYAN;
            ctx.lineWidth = 2;
            for (const o of this.orbs) {
                ctx.beginPath();
                ctx.arc(o.x + o.w/2, o.y + o.h/2, 10, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            this.player.draw(ctx);
            
            ctx.restore();
            this.draw_hud(ctx);
            ctx.save();
            ctx.translate(offX, offY);

            if (this.truth_timer > 0) {
                ctx.textAlign = 'center';
                ctx.fillStyle = GOLD;
                ctx.font = '18px Consolas, monospace';
                ctx.fillText(this.truth_msg, this.width / 2, 150);
                this.truth_timer -= 1;
            }
        }
        else if (this.state === "GAMEOVER") {
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgb(255, 50, 50)';
            ctx.font = 'bold 50px Verdana, sans-serif';
            ctx.fillText("ABYSS CONSUMED YOU", this.width / 2, this.height / 2 - 50);
            
            ctx.fillStyle = WHITE;
            ctx.font = '18px Consolas, monospace';
            ctx.fillText(`DEPTH REACHED: ${Math.floor(this.depth/10)}m | BEST: ${Math.floor(this.ss.data.high_score/10)}m`, this.width / 2, this.height / 2 + 20);
            
            ctx.fillStyle = GOLD;
            ctx.font = 'bold 28px Verdana, sans-serif';
            ctx.fillText("PRESS [R] TO REGENERATE", this.width / 2, this.height / 2 + 80);
        }
        
        ctx.restore();
    }
}

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [started, setStarted] = useState(false);

    useEffect(() => {
        if (!started) return;
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const engine = new Engine(canvas.width, canvas.height);
        
        let animationFrameId: number;
        
        const handleKeyDown = (e: KeyboardEvent) => {
            initAudio();
            engine.keys[e.key] = true;
            engine.handle_input(e.key);
        };
        
        const handleKeyUp = (e: KeyboardEvent) => {
            engine.keys[e.key] = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        const render = () => {
            engine.update();
            engine.draw(ctx);
            animationFrameId = requestAnimationFrame(render);
        };
        render();

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            cancelAnimationFrame(animationFrameId);
            engine.ss.save();
        };
    }, [started]);

    return (
        <div className="w-full h-screen bg-black flex items-center justify-center overflow-hidden font-sans">
            {!started ? (
                <div className="text-center">
                    <h1 className="text-5xl font-bold text-yellow-400 mb-4 tracking-widest">OXINE: SOVEREIGN</h1>
                    <p className="text-gray-400 mb-8 font-mono">SYSTEM INITIALIZATION REQUIRED</p>
                    <button 
                        className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-[0_0_15px_rgba(0,255,255,0.5)] transition-all transform hover:scale-105"
                        onClick={() => {
                            initAudio();
                            setStarted(true);
                        }}
                    >
                        INITIALIZE ENGINE
                    </button>
                </div>
            ) : (
                <canvas 
                    ref={canvasRef} 
                    width={1100} 
                    height={850} 
                    className="max-w-full max-h-full object-contain shadow-2xl border border-white/10"
                    style={{ backgroundColor: '#020402' }}
                />
            )}
        </div>
    );
}
