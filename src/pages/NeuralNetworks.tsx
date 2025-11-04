// src/pages/NeuralNetworks.tsx
import { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";

type Example = { inputs: [number, number]; target: number };
const XOR_DATA: Example[] = [
    { inputs: [0, 0], target: 0 },
    { inputs: [0, 1], target: 1 },
    { inputs: [1, 0], target: 1 },
    { inputs: [1, 1], target: 0 },
];

const WIDTH = 420;
const HEIGHT = 300;

/** Helpers */
const rand = (a = -1, b = 1) => Math.random() * (b - a) + a;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.floor(v)));

export default function NeuralNetworks() {
    const { theme } = useTheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // initialize with sane default so render won't crash
    const initNetwork = () => {
        const w0 = Array(8).fill(0).map(() => rand());
        const w1 = Array(4).fill(0).map(() => rand());
        const b = Array(5).fill(0).map(() => rand());
        return { w0, w1, b };
    };

    const defaults = initNetwork();

    const [weights, setWeights] = useState<number[][]>([defaults.w0, defaults.w1]);
    const [biases, setBiases] = useState<number[]>(defaults.b);
    const [hiddenOutputs, setHiddenOutputs] = useState<number[]>([0.5, 0.5, 0.5, 0.5]);
    const [output, setOutput] = useState<number>(0.5);
    const [epoch, setEpoch] = useState(0);
    const [error, setError] = useState(1);
    const [running, setRunning] = useState(false);
    const [speed, setSpeed] = useState(50);
    const [currentExample, setCurrentExample] = useState<Example>(XOR_DATA[0]);

    useEffect(() => {
        setHiddenOutputs([0.5, 0.5, 0.5, 0.5]);
        setOutput(0.5);
    }, []);

    const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
    const sigmoidDerivative = (x: number) => x * (1 - x);

    const forward = useCallback(
        (inputs: number[]) => {
            const w0 = weights[0] ?? Array(8).fill(0);
            const w1 = weights[1] ?? Array(4).fill(0);
            const b = biases ?? Array(5).fill(0);

            const hidden: number[] = [];
            for (let i = 0; i < 4; i++) {
                const w_ix = (j: number) => w0[i * 2 + j] ?? 0;
                const z = w_ix(0) * inputs[0] + w_ix(1) * inputs[1] + (b[i] ?? 0);
                hidden.push(sigmoid(z));
            }
            const out =
                sigmoid(
                    (w1[0] ?? 0) * hidden[0] +
                    (w1[1] ?? 0) * hidden[1] +
                    (w1[2] ?? 0) * hidden[2] +
                    (w1[3] ?? 0) * hidden[3] +
                    (b[4] ?? 0)
                );
            return { hidden, out };
        },
        [weights, biases]
    );

    const trainStep = useCallback(() => {
        const example = XOR_DATA[Math.floor(Math.random() * XOR_DATA.length)];
        const { hidden, out } = forward(example.inputs);
        const target = example.target;

        const outputError = target - out;
        const outputDelta = outputError * sigmoidDerivative(out);

        const w1 = weights[1] ?? Array(4).fill(0);
        const hiddenDeltas = hidden.map((h, i) => sigmoidDerivative(h) * outputDelta * (w1[i] ?? 0));

        const newW1 = [...(weights[1] ?? Array(4).fill(0))];
        for (let i = 0; i < newW1.length; i++) {
            newW1[i] += 0.5 * outputDelta * hidden[i];
        }

        const newW0 = [...(weights[0] ?? Array(8).fill(0))];
        for (let i = 0; i < 4; i++) {
            newW0[i * 2] += 0.5 * hiddenDeltas[i] * example.inputs[0];
            newW0[i * 2 + 1] += 0.5 * hiddenDeltas[i] * example.inputs[1];
        }

        const newBiases = [...(biases ?? Array(5).fill(0))];
        for (let i = 0; i < 4; i++) newBiases[i] += 0.5 * hiddenDeltas[i];
        newBiases[4] += 0.5 * outputDelta;

        setWeights([newW0, newW1]);
        setBiases(newBiases);
        setHiddenOutputs(hidden);
        setOutput(out);
        setEpoch((e) => e + 1);
        setError(Math.abs(outputError));
        setCurrentExample(example);
    }, [forward, weights, biases]);

    useEffect(() => {
        if (!running) return;
        const interval = Math.max(10, 200 - speed);
        const id = setInterval(trainStep, interval);
        return () => clearInterval(id);
    }, [running, trainStep, speed]);

    const resetNetwork = () => {
        const { w0, w1, b } = initNetwork();
        setWeights([w0, w1]);
        setBiases(b);
        setHiddenOutputs([0.5, 0.5, 0.5, 0.5]);
        setOutput(0.5);
        setEpoch(0);
        setError(1);
        setRunning(false);
        setCurrentExample(XOR_DATA[0]);
    };

    const drawNetwork = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true }) ?? null;
        if (!ctx || !canvas) return;

        // Clear canvas with theme-appropriate background
        ctx.fillStyle = theme === "dark" ? "#1f2937" : "#f9fafb";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        const neuronRadius = 20;

        const inputPos = [
            { x: 80, y: 120 },
            { x: 80, y: 180 },
        ];
        const hiddenPos = [0, 1, 2, 3].map((i) => ({ x: 210, y: 80 + i * 50 }));
        const outputPos = [{ x: 340, y: 150 }];

        const w0 = weights[0] ?? Array(8).fill(0);
        const w1 = weights[1] ?? Array(4).fill(0);

        // Draw connections (input->hidden)
        inputPos.forEach((inp, i) => {
            hiddenPos.forEach((hid, j) => {
                const w = w0[j * 2 + i] ?? 0;
                ctx.beginPath();
                ctx.moveTo(inp.x + neuronRadius, inp.y);
                ctx.lineTo(hid.x - neuronRadius, hid.y);
                ctx.strokeStyle = w >= 0 ?
                    (theme === "dark" ? "rgba(34,197,94,0.8)" : "rgba(22,163,74,0.8)") :
                    (theme === "dark" ? "rgba(239,68,68,0.8)" : "rgba(220,38,38,0.8)");
                ctx.lineWidth = Math.min(5, Math.abs(w) * 3 + 1);
                ctx.stroke();
            });
        });

        // Draw connections (hidden->output)
        hiddenPos.forEach((hid, i) => {
            const w = w1[i] ?? 0;
            ctx.beginPath();
            ctx.moveTo(hid.x + neuronRadius, hid.y);
            ctx.lineTo(outputPos[0].x - neuronRadius, outputPos[0].y);
            ctx.strokeStyle = w >= 0 ?
                (theme === "dark" ? "rgba(34,197,94,0.8)" : "rgba(22,163,74,0.8)") :
                (theme === "dark" ? "rgba(239,68,68,0.8)" : "rgba(220,38,38,0.8)");
            ctx.lineWidth = Math.min(5, Math.abs(w) * 3 + 1);
            ctx.stroke();
        });

        // Draw neurons
        const drawNeuron = (x: number, y: number, act: number, label?: string) => {
            const a = clamp01(act);
            ctx.beginPath();
            ctx.arc(x, y, neuronRadius, 0, 2 * Math.PI);

            // Theme-aware neuron colors
            if (theme === "dark") {
                const val = clamp255(a * 200 + 55); // Brighter in dark mode
                ctx.fillStyle = `rgba(${val}, ${val}, 255, 0.9)`;
            } else {
                const val = clamp255(a * 200 + 55);
                ctx.fillStyle = `rgba(${val}, ${val}, 255, 0.8)`;
            }

            ctx.fill();
            ctx.strokeStyle = theme === "dark" ? "#4b5563" : "#374151";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Text color based on theme
            ctx.fillStyle = theme === "dark" ? "#f9fafb" : "#111827";
            ctx.font = "12px system-ui, -apple-system, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label ?? act.toFixed(2), x, y);
        };

        // Draw layer labels
        ctx.fillStyle = theme === "dark" ? "#9ca3af" : "#6b7280";
        ctx.font = "14px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Input Layer", 80, 220);
        ctx.fillText("Hidden Layer", 210, 280);
        ctx.fillText("Output Layer", 340, 220);

        // inputs
        inputPos.forEach((p, i) =>
            drawNeuron(p.x, p.y, currentExample.inputs[i], currentExample.inputs[i].toString())
        );

        // hidden
        hiddenPos.forEach((p, i) => drawNeuron(p.x, p.y, hiddenOutputs[i] ?? 0.5));

        // output
        drawNeuron(outputPos[0].x, outputPos[0].y, output ?? 0.5, (output ?? 0.5).toFixed(2));
    }, [weights, hiddenOutputs, output, currentExample, theme]);

    useEffect(() => {
        drawNetwork();
    }, [drawNetwork]);

    return (
        <div className={`min-h-screen pt-20 pb-12 transition-all duration-500 ${theme === "dark"
                ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100"
                : "bg-gradient-to-br from-blue-50 via-white to-indigo-50 text-gray-900"
            }`}>
            <div className="max-w-7xl mx-auto px-6">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                        Neural Network Learning XOR
                    </h1>
                    <p className={`text-lg max-w-2xl mx-auto ${theme === "dark" ? "text-gray-300" : "text-gray-600"
                        }`}>
                        Visualizing how neural networks learn the XOR function through forward propagation and backpropagation
                    </p>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-12">
                    {/* Neural Network Visualization */}
                    <div className="xl:col-span-2">
                        <div className={`p-6 rounded-2xl shadow-2xl border ${theme === "dark"
                                ? "bg-gray-800 border-gray-700"
                                : "bg-white border-gray-200"
                            }`}>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold">Neural Network Visualization</h2>
                                <div className="flex items-center space-x-4 text-sm">
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                                        <span>Positive Weight</span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                                        <span>Negative Weight</span>
                                    </div>
                                </div>
                            </div>
                            <canvas
                                ref={canvasRef}
                                width={WIDTH}
                                height={HEIGHT}
                                className={`w-full rounded-lg border-2 ${theme === "dark" ? "border-gray-600" : "border-gray-300"
                                    }`}
                            />
                        </div>
                    </div>

                    {/* Training Controls & Stats */}
                    <div className={`p-6 rounded-2xl shadow-2xl border ${theme === "dark"
                            ? "bg-gray-800 border-gray-700"
                            : "bg-white border-gray-200"
                        }`}>
                        <h2 className="text-2xl font-bold mb-6">Training Dashboard</h2>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className={`p-4 rounded-xl ${theme === "dark" ? "bg-gray-700" : "bg-blue-50"
                                }`}>
                                <div className="text-sm opacity-75">Epochs</div>
                                <div className="text-2xl font-bold text-blue-500">{epoch.toLocaleString()}</div>
                            </div>
                            <div className={`p-4 rounded-xl ${theme === "dark" ? "bg-gray-700" : "bg-red-50"
                                }`}>
                                <div className="text-sm opacity-75">Current Error</div>
                                <div className="text-2xl font-bold text-red-500">{error.toFixed(4)}</div>
                            </div>
                            <div className={`p-4 rounded-xl ${theme === "dark" ? "bg-gray-700" : "bg-green-50"
                                }`}>
                                <div className="text-sm opacity-75">Prediction</div>
                                <div className="text-2xl font-bold text-green-500">{output.toFixed(4)}</div>
                            </div>
                            <div className={`p-4 rounded-xl ${theme === "dark" ? "bg-gray-700" : "bg-purple-50"
                                }`}>
                                <div className="text-sm opacity-75">Status</div>
                                <div className={`text-lg font-bold ${running ? 'text-green-500' : 'text-yellow-500'
                                    }`}>
                                    {running ? 'Training' : 'Paused'}
                                </div>
                            </div>
                        </div>

                        {/* Current Example */}
                        <div className={`p-4 rounded-xl mb-6 ${theme === "dark" ? "bg-gray-700" : "bg-gray-50"
                            }`}>
                            <div className="text-sm opacity-75 mb-2">Current Example</div>
                            <div className="font-mono text-lg">
                                [{currentExample.inputs.join(", ")}] → {currentExample.target}
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Training Speed: <span className="text-blue-500">{speed}</span>
                                </label>
                                <input
                                    type="range"
                                    min="10"
                                    max="190"
                                    value={speed}
                                    onChange={(e) => setSpeed(parseInt(e.target.value))}
                                    className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${theme === "dark" ? "bg-gray-700" : "bg-gray-200"
                                        }`}
                                />
                            </div>

                            <div className="flex gap-3">
                                {running ? (
                                    <button
                                        onClick={() => setRunning(false)}
                                        className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                                    >
                                        ⏸️ Stop Training
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setRunning(true)}
                                        className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                                    >
                                        ▶️ Start Training
                                    </button>
                                )}
                                <button
                                    onClick={resetNetwork}
                                    className={`py-3 px-6 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl ${theme === "dark"
                                            ? "bg-gray-700 hover:bg-gray-600 text-white"
                                            : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                                        }`}
                                >
                                    🔄 Reset
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Test Network Section */}
                <div className={`p-8 rounded-2xl shadow-2xl border mb-12 ${theme === "dark"
                        ? "bg-gray-800 border-gray-700"
                        : "bg-white border-gray-200"
                    }`}>
                    <h3 className="text-2xl font-bold mb-6">Test Network Performance</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {XOR_DATA.map((ex, i) => {
                            const { out } = forward(ex.inputs);
                            const isCorrect = Math.abs(out - ex.target) < 0.5;
                            return (
                                <div
                                    key={i}
                                    className={`p-4 rounded-xl border-2 transition-all ${isCorrect
                                            ? (theme === "dark"
                                                ? "border-green-500 bg-green-900/20"
                                                : "border-green-500 bg-green-50")
                                            : (theme === "dark"
                                            ? "border-green-500 bg-green-900/20"
                                            : "order-green-500 bg-green-50")
                                        } ${JSON.stringify(ex.inputs) === JSON.stringify(currentExample.inputs)
                                        ? 'border-green-500 bg-green-900/20'
                                            : ''
                                        }`}
                                >
                                    <div className="font-mono text-center mb-2">
                                        <div className="text-lg font-bold">[{ex.inputs.join(", ")}]</div>
                                        <div className="text-sm opacity-75">→ {ex.target}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-sm opacity-75">Prediction</div>
                                        <div className="font-bold text-lg">{out.toFixed(4)}</div>
                                        
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Educational Content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column */}
                    <div className="space-y-8">
                        <section className={`p-6 rounded-2xl shadow-lg border ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                            }`}>
                            <h3 className="text-xl font-bold mb-4">The XOR Problem</h3>
                            <p className="mb-4">
                                The XOR (exclusive OR) function outputs 1 when exactly one of its inputs is 1, and 0 otherwise.
                            </p>
                            <div className={`overflow-hidden rounded-lg border ${theme === "dark" ? "border-gray-600" : "border-gray-300"
                                }`}>
                                <table className="w-full">
                                    <thead className={theme === "dark" ? "bg-gray-700" : "bg-gray-100"}>
                                        <tr>
                                            <th className="p-3 font-semibold">Input 1</th>
                                            <th className="p-3 font-semibold">Input 2</th>
                                            <th className="p-3 font-semibold">XOR Output</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {XOR_DATA.map((row, i) => (
                                            <tr key={i} className={
                                                theme === "dark"
                                                    ? "border-t border-gray-600 even:bg-gray-700/50"
                                                    : "border-t border-gray-200 even:bg-gray-50"
                                            }>
                                                <td className="p-3 text-center">{row.inputs[0]}</td>
                                                <td className="p-3 text-center">{row.inputs[1]}</td>
                                                <td className="p-3 text-center font-bold">{row.target}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="mt-4 text-sm opacity-75">
                                XOR is not linearly separable, requiring at least one hidden layer for a neural network to learn it.
                            </p>
                        </section>

                        <section className={`p-6 rounded-2xl shadow-lg border ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                            }`}>
                            <h3 className="text-xl font-bold mb-4">Network Architecture</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10">
                                    <span>Input Layer</span>
                                    <span className="font-bold">2 neurons</span>
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10">
                                    <span>Hidden Layer</span>
                                    <span className="font-bold">4 neurons</span>
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
                                    <span>Output Layer</span>
                                    <span className="font-bold">1 neuron</span>
                                </div>
                            </div>
                            <p className="mt-4 text-sm">
                                Each connection has a weight, and each neuron (except inputs) has a bias term.
                            </p>
                        </section>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-8">
                        <section className={`p-6 rounded-2xl shadow-lg border ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                            }`}>
                            <h3 className="text-xl font-bold mb-4">Training Process</h3>
                            <ol className="space-y-3">
                                {[
                                    "Initialize weights and biases randomly (between -1 and 1)",
                                    "For each training example: Forward pass → Calculate error → Backpropagation",
                                    "One complete pass through all examples = 1 epoch",
                                    "Continue until average error < 0.05"
                                ].map((step, i) => (
                                    <li key={i} className="flex items-start">
                                        <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold mr-3 ${theme === "dark" ? "bg-blue-600" : "bg-blue-500 text-white"
                                            }`}>
                                            {i + 1}
                                        </span>
                                        <span>{step}</span>
                                    </li>
                                ))}
                            </ol>
                        </section>

                        <section className={`p-6 rounded-2xl shadow-lg border ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                            }`}>
                            <h3 className="text-xl font-bold mb-4">Visualization Guide</h3>
                            <div className="space-y-3">
                                <div className="flex items-center">
                                    <div className="w-4 h-4 bg-blue-400 rounded-full mr-3"></div>
                                    <span>Neuron brightness = activation level (0-1)</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-4 h-0.5 bg-green-500 mr-3"></div>
                                    <span>Green lines = positive weights</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-4 h-0.5 bg-red-500 mr-3"></div>
                                    <span>Red lines = negative weights</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-4 h-0.5 bg-gray-500 mr-3"></div>
                                    <span>Line thickness = weight magnitude</span>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}