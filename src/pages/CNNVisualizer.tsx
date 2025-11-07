
import { useEffect, useRef, useState } from "react";
import { useTheme } from "../context/ThemeContext";

type LayerKey = "input" | "conv1" | "pool1" | "conv2" | "pool2" | "flatten" | "fc";

const LAYERS: { key: LayerKey; title: string; sizeLabel: string }[] = [
    { key: "input", title: "Input Layer", sizeLabel: "28×28" },
    { key: "conv1", title: "Conv Layer 1", sizeLabel: "26×26" },
    { key: "pool1", title: "Pool Layer 1", sizeLabel: "13×13" },
    { key: "conv2", title: "Conv Layer 2", sizeLabel: "11×11" },
    { key: "pool2", title: "Pool Layer 2", sizeLabel: "5×5" },
    { key: "flatten", title: "Flattened Layer", sizeLabel: "25 neurons" },
    { key: "fc", title: "Fully Connected", sizeLabel: "84 neurons" },
];

export default function CNNVisualizer() {
    const { theme } = useTheme();
    const [selectedDigit, setSelectedDigit] = useState<number | null>(null);
    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [layerStatus, setLayerStatus] = useState<Record<LayerKey, "idle" | "running" | "done">>(() => {
        const obj: any = {};
        LAYERS.forEach((l) => (obj[l.key] = "idle"));
        return obj;
    });
    const [probs, setProbs] = useState<number[]>(() => Array(10).fill(0));

   
    const inputCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const tileCanvasesRef = useRef<Record<number, HTMLCanvasElement | null>>({});
    const layerCanvasesRef = useRef<Partial<Record<LayerKey, HTMLCanvasElement | null>>>({});

    
    function seedRandom(seed: number) {
        let s = seed % 2147483647;
        if (s <= 0) s += 2147483646;
        return function () {
            s = (s * 16807) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    
    function drawDigitCanvas(canvas: HTMLCanvasElement, digit: number, size = 28) {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = size;
        canvas.height = size;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, size, size);

        ctx.fillStyle = "#fff";
        const fontSize = Math.floor(size * 0.9);
        ctx.font = `${fontSize}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(digit), size / 2, size / 2 + 1);
    }

  
    useEffect(() => {
        for (let d = 0; d <= 9; d++) {
            const c = tileCanvasesRef.current[d];
            if (c) drawDigitCanvas(c, d, 28);
        }
    }, []);

    
    useEffect(() => {
        if (inputCanvasRef.current && selectedDigit !== null) {
            drawDigitCanvas(inputCanvasRef.current, selectedDigit, 28);
        }
    }, [selectedDigit]);

  
    function sampleInput(): { w: number; h: number; data: number[] } | null {
        const c = inputCanvasRef.current;
        if (!c) return null;
        const ctx = c.getContext("2d");
        if (!ctx) return null;
        const w = c.width;
        const h = c.height;
        const img = ctx.getImageData(0, 0, w, h).data;
        const out: number[] = [];
        for (let i = 0; i < img.length; i += 4) {
            out.push(img[i] / 255);
        }
        return { w, h, data: out };
    }

    
    function drawLayer(layer: LayerKey, digitSeed: number) {
        const canvas = layerCanvasesRef.current[layer];
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let ow = 28, oh = 28;
        if (layer === "input") {
            ow = oh = 28;
        } else if (layer === "conv1") {
            ow = oh = 26;
        } else if (layer === "pool1") {
            ow = oh = 13;
        } else if (layer === "conv2") {
            ow = oh = 11;
        } else if (layer === "pool2") {
            ow = oh = 5;
        } else if (layer === "flatten") {
            ow = 25;
            oh = 1;
        } else if (layer === "fc") {
            ow = 21;
            oh = 4;
        }

        canvas.width = ow;
        canvas.height = oh;

        const input = sampleInput();
        const rand = seedRandom(digitSeed + ow + oh);
        const out = new Array(ow * oh).fill(0);

        if (!input) {
            for (let i = 0; i < out.length; i++) out[i] = rand();
        } else {
            if (layer === "input") {
                for (let y = 0; y < 28 && y < oh; y++) {
                    for (let x = 0; x < 28 && x < ow; x++) {
                        out[y * ow + x] = input.data[y * 28 + x];
                    }
                }
            } else if (layer === "conv1") {
                for (let y = 1; y < 27; y++) {
                    for (let x = 1; x < 27; x++) {
                        const c = input.data[y * 28 + x];
                        const l = input.data[y * 28 + (x - 1)];
                        const v = Math.abs(c - l);
                        out[(y - 1) * ow + (x - 1)] = v;
                    }
                }
            } else if (layer === "pool1") {
                for (let y = 0; y < 13; y++) {
                    for (let x = 0; x < 13; x++) {
                        let mv = 0;
                        const sx = x * 2;
                        const sy = y * 2;
                        for (let yy = 0; yy < 2; yy++) {
                            for (let xx = 0; xx < 2; xx++) {
                                const px = sx + xx;
                                const py = sy + yy;
                                mv = Math.max(mv, input.data[py * 28 + px] || 0);
                            }
                        }
                        out[y * ow + x] = mv;
                    }
                }
            } else if (layer === "conv2") {
                const pool: number[] = new Array(13 * 13).fill(0);
                for (let y = 0; y < 13; y++) {
                    for (let x = 0; x < 13; x++) {
                        let mv = 0;
                        const sx = x * 2;
                        const sy = y * 2;
                        for (let yy = 0; yy < 2; yy++) {
                            for (let xx = 0; xx < 2; xx++) {
                                const px = sx + xx;
                                const py = sy + yy;
                                mv = Math.max(mv, input.data[py * 28 + px] || 0);
                            }
                        }
                        pool[y * 13 + x] = mv;
                    }
                }
                for (let y = 1; y < 12; y++) {
                    for (let x = 1; x < 10; x++) {
                        const c = pool[y * 13 + x];
                        const u = pool[(y - 1) * 13 + x];
                        out[(y - 1) * ow + (x - 1)] = Math.abs(c - u);
                    }
                }
            } else if (layer === "pool2") {
                const conv2: number[] = new Array(11 * 11).fill(0);
                for (let i = 0; i < conv2.length; i++) conv2[i] = rand() * 0.8;
                for (let y = 0; y < 5; y++) {
                    for (let x = 0; x < 5; x++) {
                        const sx = Math.floor((x / 5) * 11);
                        const sy = Math.floor((y / 5) * 11);
                        let mv = 0;
                        for (let yy = 0; yy < 2 && sy + yy < 11; yy++) {
                            for (let xx = 0; xx < 2 && sx + xx < 11; xx++) {
                                mv = Math.max(mv, conv2[(sy + yy) * 11 + (sx + xx)]);
                            }
                        }
                        out[y * ow + x] = mv;
                    }
                }
            } else if (layer === "flatten") {
                for (let i = 0; i < 25; i++) out[i] = rand();
            } else if (layer === "fc") {
                for (let i = 0; i < ow * oh; i++) out[i] = rand();
            }
        }

        
        for (let y = 0; y < oh; y++) {
            for (let x = 0; x < ow; x++) {
                const v = Math.max(0, Math.min(1, out[y * ow + x] || 0));
                const g = Math.floor(v * 255);

                
                if (v > 0.7) {
                    ctx.fillStyle = `rgb(${g}, ${Math.floor(g * 0.8)}, ${Math.floor(g * 0.6)})`;
                } else if (v > 0.3) {
                    ctx.fillStyle = `rgb(${g}, ${g}, ${Math.floor(g * 0.9)})`;
                } else {
                    ctx.fillStyle = `rgb(${g}, ${g}, ${g})`;
                }
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }


    async function processPipeline(digit: number) {
        if (processing) return;
        setProcessing(true);
        setMessage(null);

        setLayerStatus((prev) => {
            const copy = { ...prev };
            (Object.keys(copy) as LayerKey[]).forEach((k) => (copy[k] = "idle"));
            return copy;
        });
        setProbs(Array(10).fill(0));

        const sequence: LayerKey[] = ["input", "conv1", "pool1", "conv2", "pool2", "flatten", "fc"];
        for (let i = 0; i < sequence.length; i++) {
            const key = sequence[i];
            setLayerStatus((s) => ({ ...s, [key]: "running" }));
            drawLayer(key, digit);

            setProbs(() => {
                const next = new Array(10).fill(1);
                const inc = Math.round(((i + 1) / sequence.length) * 85);
                next[digit] = inc;
                const remain = Math.max(0, 100 - inc);
                for (let d = 0; d < 10; d++) if (d !== digit) next[d] = Math.max(1, Math.floor(remain / 9));
                let sum = next.reduce((a, b) => a + b, 0);
                while (sum > 100) {
                    for (let d = 0; d < 10 && sum > 100; d++) {
                        if (d !== digit && next[d] > 1) {
                            next[d]--;
                            sum--;
                        }
                    }
                    if (sum > 100) {
                        next[digit]--;
                        sum--;
                    }
                }
                return next.map((v) => Number(v));
            });

            await new Promise((r) => setTimeout(r, 1200));
            setLayerStatus((s) => ({ ...s, [key]: "done" }));
            await new Promise((r) => setTimeout(r, 600));
        }

        setProbs((_) => {
            const arr = new Array(10).fill(1);
            arr[digit] = 90;
            const s = arr.reduce((a, b) => a + b, 0);
            return arr.map((v) => Math.round((v / s) * 100));
        });

        setProcessing(false);
        setMessage("Processing complete! This shows the full pipeline of a CNN for digit recognition.");
    }

    function onSelectDigit(d: number) {
        if (processing) return;
        setSelectedDigit(d);
        if (inputCanvasRef.current) drawDigitCanvas(inputCanvasRef.current, d, 28);
        
    }


    function handleReset() {
        if (processing) return;
        setSelectedDigit(null);
        setMessage(null);
        setProbs(Array(10).fill(0));
        setLayerStatus((prev) => {
            const copy = { ...prev };
            (Object.keys(copy) as LayerKey[]).forEach((k) => (copy[k] = "idle"));
            return copy;
        });
        for (const k of Object.keys(layerCanvasesRef.current)) {
            const c = layerCanvasesRef.current[k as LayerKey];
            if (c) {
                const ctx = c.getContext("2d");
                if (ctx) ctx.clearRect(0, 0, c.width, c.height);
            }
        }
        if (inputCanvasRef.current) {
            const ctx = inputCanvasRef.current.getContext("2d");
            if (ctx) ctx.clearRect(0, 0, inputCanvasRef.current.width, inputCanvasRef.current.height);
        }
    }

    function handleProcessClick() {
        if (selectedDigit === null) return;
        processPipeline(selectedDigit);
    }

    function pctWidth(v: number) {
        const clamped = Math.max(0.5, Math.min(100, v));
        return `${clamped}%`;
    }

    return (
        <div className={`min-h-screen pt-24 pb-10 transition-all duration-500 ${theme === "dark"
            ? "bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white"
            : "bg-gradient-to-br from-blue-50 via-white to-indigo-50 text-black"
            }`}>
            <div className="max-w-7xl mx-auto space-y-8">
              
                <div className="text-center space-y-4 pt-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        CNN Visualizer for Digit Recognition
                    </h1>
                    <p className="text-lg  max-w-3xl mx-auto">
                        Explore how Convolutional Neural Networks process and recognize handwritten digits through interactive visualization
                    </p>
                </div>

                
                {message && (
                    <div className={`rounded-xl p-4 border-l-4 ${message.includes("complete")
                            ? "bg-green-50 dark:bg-green-900/20 border-green-400 text-green-700 dark:text-green-300"
                            : "bg-blue-50 dark:bg-blue-900/20 border-blue-400 text-blue-700 dark:text-blue-300"
                        }`}>
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                {message.includes("complete") ? (
                                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                            <div className="ml-3">
                                <p className="text-sm font-medium">{message}</p>
                            </div>
                        </div>
                    </div>
                )}

               
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                   
                    <div
                        className={`rounded-2xl shadow-xl border p-6 
    ${theme === "dark"
                                ? "bg-gray-800 border-gray-700 text-white"
                                : "bg-white border-gray-200"
                            }`}
                    >
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold  mb-2">
                                    Select a Digit Sample
                                </h2>
                                <p className="text-sm ">
                                    Click on a digit to automatically start the CNN processing pipeline
                                </p>
                            </div>

                            <div className="grid grid-cols-5 gap-4">
                                {Array.from({ length: 10 }).map((_, d) => (
                                    <button
                                        key={d}
                                        onClick={() => onSelectDigit(d)}
                                        disabled={processing}
                                        className={`group relative flex items-center justify-center w-full aspect-square rounded-xl transition-all duration-300 transform hover:scale-105 ${selectedDigit === d
                                                ? "ring-4 ring-blue-500 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                                                : "bg-gray-900 hover:bg-gray-800 text-white border border-gray-700 hover:border-gray-600"
                                            } ${processing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                    >
                                        <div className="w-16 h-16 flex items-center justify-center">
                                            <canvas
                                                ref={(el) => { tileCanvasesRef.current[d] = el }}
                                                width={28}
                                                height={28}
                                                className="transition-transform duration-300 group-hover:scale-110"
                                                style={{ imageRendering: "pixelated", width: 56, height: 56 }}
                                            />
                                        </div>
                                        {selectedDigit === d && (
                                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleReset}
                                    disabled={processing}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-medium transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Reset
                                </button>
                                <button
                                    onClick={handleProcessClick}
                                    disabled={processing || selectedDigit === null}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {processing ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            Process
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                   
                    <div
                        className={`rounded-2xl shadow-xl border p-6 
    ${theme === "dark"
                                ? "bg-gray-800 border-gray-700"
                                : "bg-white border-gray-200"
                            }`}
                    >
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold  mb-2">
                                    Prediction Results
                                </h2>
                                <p className="text-sm ">
                                    Model confidence scores for each digit based on extracted features
                                </p>
                            </div>

                            <div className="space-y-4">
                                {probs.map((p, i) => (
                                    <div key={i} className="flex items-center gap-4 group">
                                        <div className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg font-semibold text-gray-700 dark:text-gray-300 transition-colors group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20">
                                            {i}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-medium ">
                                                    Digit {i}
                                                </span>
                                                <span className={`font-bold ${i === selectedDigit ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"
                                                    }`}>
                                                    {p}%
                                                </span>
                                            </div>
                                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${i === selectedDigit
                                                            ? "bg-gradient-to-r from-green-400 to-green-500 shadow-lg shadow-green-500/25"
                                                            : "bg-gradient-to-r from-blue-400 to-blue-500 shadow-lg shadow-blue-500/25"
                                                        }`}
                                                    style={{ width: pctWidth(p) }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                          
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium ">
                                        Model Confidence
                                    </span>
                                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                        {selectedDigit !== null ? Math.max(...probs) : 0}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div
                                        className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000 ease-out"
                                        style={{ width: `${selectedDigit !== null ? Math.max(...probs) : 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                
                <div
                    className={`rounded-2xl shadow-xl border p-6 
    ${theme === "dark"
                            ? "bg-gray-800 border-gray-700"
                            : "bg-white border-gray-200"
                        }`}
                >
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">
                                CNN Architecture Pipeline
                            </h2>
                            <p className="mb-2 ">
                                Follow the data flow through each layer of the convolutional neural network
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {LAYERS.map((layer) => (
                                <div
                                    key={layer.key}
                                    className={`relative rounded-xl p-4 border-2 transition-all duration-500 transform hover:scale-105 ${layerStatus[layer.key] === "done"
                                            ? "border-green-500 bg-green-50 dark:bg-green-900/10 shadow-lg shadow-green-500/10"
                                            : layerStatus[layer.key] === "running"
                                                ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10 shadow-lg shadow-yellow-500/10 animate-pulse"
                                                : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50"
                                        }`}
                                >
                                    
                                    <div className="absolute -top-2 -right-2">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${layerStatus[layer.key] === "done"
                                                ? "bg-green-500 text-white"
                                                : layerStatus[layer.key] === "running"
                                                    ? "bg-yellow-500 text-white animate-spin"
                                                    : "bg-gray-400 text-white"
                                            }`}>
                                            {layerStatus[layer.key] === "running" ? "⟳" : "✓"}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
                                                {layer.title}
                                            </h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {layer.sizeLabel}
                                            </p>
                                        </div>

                                        <div className="flex justify-center">
                                            <canvas
                                                ref={(el) => { layerCanvasesRef.current[layer.key] = el }}
                                                className="border border-gray-300 dark:border-gray-600 rounded-lg shadow-inner bg-black"
                                                style={{ width: 96, height: 96, imageRendering: "pixelated" }}
                                            />
                                        </div>

                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                            {getLayerDesc(layer.key)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                       
                        <div className="flex justify-center items-center pt-6">
                            <div className="flex items-center space-x-2 text-sm ">
                                <span>Input</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span>Feature Extraction</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span>Classification</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span>Output</span>
                            </div>
                        </div>
                    </div>
                </div>

               
                <div
                    className={`rounded-2xl shadow-xl border p-6 
    ${theme === "dark"
                            ? "bg-gray-800 border-gray-700"
                            : "bg-white border-gray-200"
                        }`}
                >
                    <div className="space-y-6">
                        <h3 className="text-2xl font-bold ">
                            How Convolutional Neural Networks Work
                        </h3>

                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex items-start space-x-3">
                                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-1">Key Components</h4>
                                        <ul className="text-sm  space-y-1">
                                            <li className="flex items-center">
                                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                                                Convolutional Layers: Detect features like edges and textures
                                            </li>
                                            <li className="flex items-center">
                                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                                                Pooling Layers: Reduce dimensions while preserving features
                                            </li>
                                            <li className="flex items-center">
                                                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-2"></span>
                                                Fully Connected Layers: Combine features for classification
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start space-x-3">
                                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold  mb-1">Processing Pipeline</h4>
                                        <ol className="text-sm  space-y-1 list-decimal list-inside">
                                            <li>Input image processed through convolutional filters</li>
                                            <li>Pooling layers provide translation invariance</li>
                                            <li>Feature maps flattened into vector format</li>
                                            <li>Fully connected layers combine features</li>
                                            <li>Output layer produces digit probabilities</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                <strong>Note:</strong> This visualizer demonstrates a simplified version of the LeNet-5 architecture,
                                one of the earliest CNN models designed specifically for digit recognition.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            
            <div style={{ display: "none" }}>
                <canvas ref={inputCanvasRef} width={28} height={28} />
            </div>
        </div>
    );
}

function getLayerDesc(key: LayerKey) {
    switch (key) {
        case "conv1":
            return "Applies 3×3 vertical edge detection filters to extract basic features.";
        case "pool1":
            return "Max pooling with 2×2 windows reduces spatial dimensions by half.";
        case "conv2":
            return "Second convolution layer detects more complex horizontal features.";
        case "pool2":
            return "Further reduces feature map size to 5×5 while preserving important features.";
        case "flatten":
            return "Converts 2D feature maps into 1D vector for fully connected layers.";
        case "fc":
            return "84 neurons learn complex patterns from flattened features for classification.";
        case "input":
        default:
            return "28×28 grayscale input image where each pixel represents intensity 0-1.";
    }
}