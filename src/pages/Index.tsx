import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Gauge,
  Infinity as InfinityIcon,
  PlayCircle,
  Shield,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Vector3 = [number, number, number];

const CameraRig = () => {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime() / 4.5; // câmera lenta suave
    camera.position.x = Math.sin(t) * 2.4;
    camera.position.y = 1.1 + Math.sin(t * 0.7) * 0.24;
    camera.position.z = 5 + Math.cos(t) * 0.9;
    camera.lookAt(0, 0, 0);
  });

  return null;
};

const NeonOrb = ({ position, color }: { position: Vector3; color: string }) => (
  <Float speed={1.6} rotationIntensity={1.2} floatIntensity={1.1}>
    <mesh position={position}>
      <icosahedronGeometry args={[0.75, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.7}
        metalness={0.5}
        roughness={0.2}
      />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[position[0], position[1] - 1.1, position[2]]}>
      <ringGeometry args={[0.5, 0.9, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.3} />
    </mesh>
  </Float>
);

const FloatingCard = ({ position, color }: { position: Vector3; color: string }) => (
  <Float speed={1.1} rotationIntensity={0.9} floatIntensity={0.6}>
    <mesh position={position} rotation={[0.4, 0.7, 0.2]}>
      <boxGeometry args={[1.6, 1, 0.32]} />
      <meshStandardMaterial
        color={color}
        metalness={0.65}
        roughness={0.18}
        emissive={color}
        emissiveIntensity={0.12}
      />
    </mesh>
  </Float>
);

const HeroScene = () => (
  <Canvas camera={{ position: [0, 1.4, 6] }}>
    <color attach="background" args={["#060a1d"]} />
    <ambientLight intensity={0.5} />
    <spotLight position={[5, 7, 5]} angle={0.4} penumbra={1} intensity={2.4} color="#7dd3fc" />
    <pointLight position={[-6, -2, -2]} intensity={1.5} color="#a78bfa" />
    <CameraRig />

    <NeonOrb position={[-1.4, 0.4, 0]} color="#60a5fa" />
    <NeonOrb position={[1.2, 0.8, -0.4]} color="#22d3ee" />
    <FloatingCard position={[0, -0.4, 0.8]} color="#1d4ed8" />
    <FloatingCard position={[-2.1, 0.2, -1]} color="#22d3ee" />
    <FloatingCard position={[2.2, 0.4, -0.6]} color="#60a5fa" />

    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]}>
      <planeGeometry args={[12, 12]} />
      <meshStandardMaterial color="#0b1229" metalness={0.35} roughness={0.92} />
    </mesh>

    <gridHelper args={[10, 18, "#1d2a52", "#0f172a"]} position={[0, -1.59, 0]} />
  </Canvas>
);

const useParallax = (factor = 0.08) => {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => setOffset(window.scrollY * factor);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [factor]);

  return offset;
};

const Index = () => {
  const parallax = useParallax();
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const pricing = useMemo(
    () => ({
      free: {
        title: "Free",
        price: "R$ 0",
        desc: "Comece em segundos com tudo que importa para organizar seu dinheiro.",
        perks: [
          "Até 20 entradas/saídas por mês",
          "Dashboard e gráficos em tempo real",
          "Importação OFX/CSV e exportação",
          "Alertas básicos e categorização rápida",
        ],
      },
      premium: {
        title: "Finan Pro",
        price: "R$ 9,90/mês",
        desc: "Desbloqueie lançamentos ilimitados, metas e orçamentos inteligentes.",
        perks: [
          "Lançamentos ilimitados",
          "Metas e orçamentos com alertas inteligentes",
          "Projeções e visão de longo prazo",
          "Suporte prioritário e roadmap premium",
        ],
      },
    }),
    []
  );

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!highlightRef.current) return;
    const rect = highlightRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 12;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * -12;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  return (
    <div className="min-h-screen text-white bg-transparent">
      <div
        className="fixed inset-x-0 top-0 h-[55vh] blur-3xl opacity-60 pointer-events-none glow-pulse"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(96,165,250,0.35), transparent 45%), radial-gradient(circle at 70% 10%, rgba(34,211,238,0.3), transparent 35%)",
          transform: `translate3d(0, ${-parallax * 0.3}px, 0)`,
        }}
      />

      <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/30 border-b border-white/5">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-300">FinanSaaS</p>
              <p className="text-lg font-semibold text-white">Cashflow em modo cinema</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-white/5 border-white/10 text-slate-100">
              Freemium liberado
            </Badge>
            <Button asChild variant="secondary" className="bg-white text-slate-900 hover:bg-slate-200">
              <Link to="/login">Entrar</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <section className="relative z-10">
          <div className="mx-auto max-w-6xl px-6 pt-12 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge className="bg-sky-500/20 text-sky-100 border border-sky-400/30">
                  Modelos 3D · Parallax · Slow camera
                </Badge>
                <h1 className="text-4xl lg:text-5xl font-bold leading-tight text-white">
                  Controle financeiro com uma experiência imersiva e fluida em português.
                </h1>
                <p className="text-lg text-slate-300">
                  Interface cinematográfica com rolagem parallax, modelos 3D e efeitos de câmera lenta.
                  Plano Free para começar agora e upgrade premium de R$ 9,90/mês para lançamentos ilimitados, metas e orçamentos.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Button size="lg" asChild className="bg-gradient-to-r from-sky-400 to-blue-700 text-white shadow-lg shadow-blue-500/30">
                  <Link to="/login" className="flex items-center gap-2">
                    Começar grátis
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10" asChild>
                  <Link to="/login#premium" className="flex items-center gap-2">
                    Ver Finan Pro
                    <PlayCircle className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { icon: Gauge, label: "Experiência cinematográfica" },
                  { icon: Activity, label: "Parallax + câmera lenta" },
                  { icon: Shield, label: "Segurança de ponta" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 shadow-sm shadow-sky-500/10"
                  >
                    <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-sky-200" />
                    </div>
                    <p className="text-sm text-slate-200">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              ref={highlightRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="relative aspect-[4/5] w-full rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-900/40 border border-white/5 shadow-2xl"
              style={{
                transform: `perspective(1200px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) translateZ(0)`,
                transition: "transform 180ms ease-out",
              }}
            >
              <div className="absolute inset-0 pointer-events-none">
                <div
                  className="absolute -top-10 left-10 h-48 w-48 rounded-full bg-sky-400/30 blur-3xl glow-pulse"
                  style={{ transform: `translate3d(0, ${-parallax * 0.15}px, 0)` }}
                />
                <div
                  className="absolute bottom-0 right-8 h-56 w-56 rounded-full bg-blue-700/30 blur-3xl glow-pulse"
                  style={{ transform: `translate3d(0, ${-parallax * 0.08}px, 0)` }}
                />
              </div>
              <HeroScene />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-sky-500/20 flex items-center justify-center">
                    <BadgeCheck className="h-5 w-5 text-sky-200" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-200">Plano Free</p>
                    <p className="text-xs text-slate-400">20 lançamentos/mês · pronto pra usar</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-200">Finan Pro</p>
                  <p className="text-lg font-semibold text-white">R$ 9,90/mês</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative py-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-white/5 pointer-events-none" />
          <div className="mx-auto max-w-6xl px-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Sparkles,
                title: "Modelos 3D e parallax",
                desc: "Cenas 3D em tempo real com interação de rolagem e câmera lenta suave.",
              },
              {
                icon: Activity,
                title: "Interface fluida",
                desc: "Micro interações, glassmorphism e alta taxa de quadros para navegação sem atrito.",
              },
              {
                icon: Shield,
                title: "Pronto para produção",
                desc: "Segurança, autenticação e dados criptografados para você lançar sem medo.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group bg-white/5 border border-white/10 rounded-2xl p-6 shadow-lg shadow-black/20 hover:border-sky-400/40 transition-colors"
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-sky-400/30 to-blue-600/40 flex items-center justify-center text-white mb-4">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-slate-300 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="premium" className="relative z-10 py-16 pb-10">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
              <div className="space-y-3">
                <Badge className="bg-green-500/15 text-green-100 border border-green-400/30">
                  Freemium sem pegadinhas
                </Badge>
                <h2 className="text-3xl font-bold text-white">
                  Escolha onde começar e evolua para o Finan Pro quando precisar.
                </h2>
                <p className="text-slate-300 max-w-2xl">
                  Crie sua conta gratuita e lance até 20 entradas/saídas por mês. Ao precisar de mais, desbloqueie
                  lançamentos ilimitados, metas e orçamentos por apenas R$ 9,90/mês.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <InfinityIcon className="h-8 w-8 text-sky-200" />
                <span className="text-slate-200 text-sm">Lançamentos ilimitados no Finan Pro</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[pricing.free, pricing.premium].map((plan) => (
                <div
                  key={plan.title}
                  className="relative rounded-3xl p-6 bg-white/5 border border-white/10 shadow-xl shadow-black/20 overflow-hidden"
                >
                  <div className="absolute -right-10 -top-10 h-32 w-32 bg-gradient-to-br from-sky-400/20 to-blue-700/20 rounded-full blur-3xl" />
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-slate-300">{plan.title}</p>
                      <p className="text-3xl font-bold text-white">{plan.price}</p>
                    </div>
                    {plan.title === "Finan Pro" ? (
                      <Badge className="bg-sky-500 text-white border-0">Recomendado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-200 border-white/20">
                        Comece agora
                      </Badge>
                    )}
                  </div>
                  <p className="text-slate-300 mb-6">{plan.desc}</p>
                  <div className="space-y-3">
                    {plan.perks.map((perk) => (
                      <div key={perk} className="flex items-center gap-3 text-slate-200">
                        <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                          <CheckIcon />
                        </div>
                        <span>{perk}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    asChild
                    className="mt-6 w-full bg-gradient-to-r from-sky-400 to-blue-700 text-white hover:opacity-95"
                    variant={plan.title === "Finan Pro" ? "default" : "secondary"}
                  >
                    <Link to="/login">{plan.title === "Finan Pro" ? "Desbloquear Finan Pro" : "Criar conta Free"}</Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative py-16">
          <div className="mx-auto max-w-6xl px-6 bg-white/5 border border-white/10 rounded-3xl p-8 shadow-xl shadow-black/30">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="space-y-4">
                <Badge className="bg-white/10 text-white border-white/20">Fluxo de conta claro</Badge>
                <h3 className="text-2xl font-semibold text-white">Criação de contas com limites transparentes</h3>
                <p className="text-slate-300">
                  Ao criar uma conta Free você pode registrar até 20 entradas/saídas por mês. Ultrapassou?
                  Ative o Finan Pro por R$ 9,90/mês e libere lançamentos ilimitados, metas e orçamentos com alertas.
                  Todo o restante continua disponível para quem está no plano gratuito.
                </p>
              </div>
              <div className="relative">
                <div className="absolute -inset-6 bg-gradient-to-br from-sky-500/10 to-blue-700/10 blur-3xl" />
                <div className="relative rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200">Plano atual</span>
                    <Badge className="bg-emerald-500/20 text-emerald-100 border-0">Free</Badge>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between text-slate-200">
                      <span>Entradas/Saídas do mês</span>
                      <span>12 / 20</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 mt-3 overflow-hidden">
                      <div className="h-2 bg-gradient-to-r from-sky-400 to-blue-700 rounded-full" style={{ width: "60%" }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Limite Free: 20 lançamentos/mês</p>
                  </div>
                  <div className="space-y-2 text-sm text-slate-200">
                    <div className="flex items-center gap-2">
                      <CheckIcon />
                      <span>Metas e orçamentos desbloqueados no Finan Pro</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckIcon />
                      <span>Demais recursos permanecem disponíveis no plano Free</span>
                    </div>
                  </div>
                  <Button asChild className="w-full bg-gradient-to-r from-sky-400 to-blue-700 text-white">
                    <Link to="/login">Ir para o cadastro</Link>
                  </Button>
                </div>
              </div>
      </div>
      </div>
        </section>
      </main>
    </div>
  );
};

const CheckIcon = () => <span className="inline-flex h-4 w-4 items-center justify-center text-sky-200">✓</span>;

export default Index;
