import { useEffect, useRef, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import {
    FaChartLine,
    FaBrain,
    FaNetworkWired,
    FaProjectDiagram,
    FaCalculator,
    FaPlay,
    FaPause,
    FaRedo
} from "react-icons/fa";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

export default function Compare() {
    const { theme } = useTheme();

    const [points, setPoints] = useState<{ x: number; y: number }[]>([
        { x: 1, y: 1 },
        { x: 2, y: 2.3 },
        { x: 3, y: 2.7 },
        { x: 4, y: 3.8 },
        { x: 5, y: 5 },
    ]);
    const [xInput, setXInput] = useState("");
    const [yInput, setYInput] = useState("");
    const [animationState, setAnimationState] = useState({
        linear: 'paused',
        nn: 'paused',
        cnn: 'paused'
    });
    const [calculations, setCalculations] = useState({
        slope: 0,
        intercept: 0,
        rSquared: 0,
        mse: 0
    });
    const [activeModel, setActiveModel] = useState<string | null>(null);

    const linearChartRef = useRef<HTMLCanvasElement | null>(null);
    const nnChartRef = useRef<HTMLCanvasElement | null>(null);
    const cnnChartRef = useRef<HTMLCanvasElement | null>(null);
    const animationRef = useRef<number>(0);
    const frameRef = useRef<number>(0);


    const calculateRegression = () => {
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        const n = xs.length;

        const meanX = xs.reduce((a, b) => a + b) / n;
        const meanY = ys.reduce((a, b) => a + b) / n;

        const num = xs.reduce((acc, x, i) => acc + (x - meanX) * (ys[i] - meanY), 0);
        const den = xs.reduce((acc, x) => acc + (x - meanX) ** 2, 0);
        const slope = num / den;
        const intercept = meanY - slope * meanX;

        
        const regressionY = xs.map((x) => slope * x + intercept);
        const ssRes = ys.reduce((acc, y, i) => acc + (y - regressionY[i]) ** 2, 0);
        const ssTot = ys.reduce((acc, y) => acc + (y - meanY) ** 2, 0);
        const rSquared = 1 - (ssRes / ssTot);
        const mse = ssRes / n;

        setCalculations({ slope, intercept, rSquared, mse });

        return { slope, intercept, regressionY, xs };
    };

    useEffect(() => {
        const ctx1 = linearChartRef.current?.getContext("2d");
        const ctx2 = nnChartRef.current?.getContext("2d");
        const ctx3 = cnnChartRef.current?.getContext("2d");

        if (!ctx1 || !ctx2 || !ctx3) return;

        const { slope, intercept, regressionY, xs } = calculateRegression();

        
        const linearChart = new Chart(ctx1, {
            type: "scatter",
            data: {
                datasets: [
                    {
                        label: "Data Points",
                        data: points,
                        backgroundColor: "#3b82f6",
                        pointRadius: 6,
                        pointHoverRadius: 8,
                    },
                    {
                        label: "Regression Line",
                        type: "line",
                        data: xs.map((x, i) => ({ x, y: regressionY[i] })),
                        borderColor: "#10b981",
                        borderWidth: 3,
                        fill: false,
                        tension: 0,
                        pointRadius: 0,
                    },
                    {
                        label: "Error Lines",
                        type: "line",
                        data: points.flatMap((point) => [
                            { x: point.x, y: point.y },
                            { x: point.x, y: slope * point.x + intercept }
                        ]),

                        borderColor: "#ef4444",
                        borderWidth: 1,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        showLine: true,
                    }
                ],
            },
            options: {
                responsive: true,
                animation: {
                    duration: animationState.linear === 'playing' ? 1000 : 0,
                    easing: 'easeOutQuart'
                },
                scales: {
                    x: {
                        type: "linear",
                        title: { display: true, text: "X" },
                        grid: { color: theme === 'dark' ? '#374151' : '#e5e7eb' }
                    },
                    y: {
                        type: "linear",
                        title: { display: true, text: "Y" },
                        grid: { color: theme === 'dark' ? '#374151' : '#e5e7eb' }
                    },
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                if (context.dataset.label === "Data Points") {
                                    return `Point: (${context.parsed.x}, ${context.parsed.y})`;
                                }
                                return context.dataset.label || '';
                            }
                        }
                    }
                }
            },
        });

        
        const animateActivation = (frame: number) => {
            const progress = (frame % 100) / 100;
            return Array.from({ length: 50 }, (_, i) => {
                const x = (i / 5 - 5) + progress * 2;
                return 1 / (1 + Math.exp(-x));
            });
        };

        const nnChart = new Chart(ctx2, {
            type: "line",
            data: {
                labels: Array.from({ length: 50 }, (_, i) => i),
                datasets: [
                    {
                        label: "Sigmoid Activation",
                        data: animateActivation(0),
                        borderColor: "#f59e0b",
                        borderWidth: 3,
                        fill: false,
                        tension: 0.1,
                    },
                    {
                        label: "Tanh Activation",
                        data: Array.from({ length: 50 }, (_, i) =>
                            Math.tanh(i / 5 - 5)
                        ),
                        borderColor: "#8b5cf6",
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.1,
                    },
                    {
                        label: "ReLU Activation",
                        data: Array.from({ length: 50 }, (_, i) =>
                            Math.max(0, i / 5 - 3)
                        ),
                        borderColor: "#ef4444",
                        borderWidth: 2,
                        fill: false,
                        tension: 0,
                    }
                ],
            },
            options: {
                animation: {
                    duration: animationState.nn === 'playing' ? 50 : 0,
                },
                responsive: true,
                scales: {
                    x: {
                        title: { display: true, text: "Input Signal" },
                        grid: { color: theme === 'dark' ? '#374151' : '#e5e7eb' }
                    },
                    y: {
                        title: { display: true, text: "Activation Output" },
                        grid: { color: theme === 'dark' ? '#374151' : '#e5e7eb' }
                    },
                },
            },
        });

        
        const animateFeatures = (frame: number) => {
            const progress = (frame % 60) / 60;
            return [0.2, 0.6, 0.8, 0.5, 0.9].map((val, i) =>
                val * (0.8 + 0.4 * Math.sin(progress * Math.PI * 2 + i * 0.5))
            );
        };

        const cnnChart = new Chart(ctx3, {
            type: "bar",
            data: {
                labels: ["Edge 1", "Edge 2", "Corner", "Texture", "Pattern"],
                datasets: [
                    {
                        label: "Feature Strength",
                        data: animateFeatures(0),
                        backgroundColor: [
                            "#3b82f6",
                            "#60a5fa",
                            "#10b981",
                            "#facc15",
                            "#ef4444",
                        ],
                        borderColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                animation: {
                    duration: animationState.cnn === 'playing' ? 100 : 0,
                },
                scales: {
                    y: {
                        min: 0,
                        max: 1,
                        title: { display: true, text: "Activation Strength" },
                        grid: { color: theme === 'dark' ? '#374151' : '#e5e7eb' }
                    },
                    x: {
                        grid: { color: theme === 'dark' ? '#374151' : '#e5e7eb' }
                    }
                },
            },
        });

       
        const animate = () => {
            frameRef.current++;

            if (animationState.nn === 'playing') {
                nnChart.data.datasets[0].data = animateActivation(frameRef.current);
                nnChart.update('none');
            }

            if (animationState.cnn === 'playing') {
                cnnChart.data.datasets[0].data = animateFeatures(frameRef.current);
                cnnChart.update('none');
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        if (animationState.nn === 'playing' || animationState.cnn === 'playing') {
            animate();
        }

        return () => {
            linearChart.destroy();
            nnChart.destroy();
            cnnChart.destroy();
            cancelAnimationFrame(animationRef.current);
        };
    }, [points, animationState, theme]);

    const addPoint = () => {
        const x = parseFloat(xInput);
        const y = parseFloat(yInput);
        if (!isNaN(x) && !isNaN(y)) {
            setPoints((prev) => [...prev, { x, y }]);
            setXInput("");
            setYInput("");
        }
    };

    const toggleAnimation = (chart: keyof typeof animationState) => {
        setAnimationState(prev => ({
            ...prev,
            [chart]: prev[chart] === 'playing' ? 'paused' : 'playing'
        }));
    };

    const resetPoints = () => {
        setPoints([
            { x: 1, y: 1 },
            { x: 2, y: 2.3 },
            { x: 3, y: 2.7 },
            { x: 4, y: 3.8 },
            { x: 5, y: 5 },
        ]);
    };

    const highlightModel = (model: string) => {
        setActiveModel(model);
        setTimeout(() => setActiveModel(null), 2000);
    };

    return (
        <div
            className={`min-h-screen pt-24 pb-10 transition-all duration-500 ${theme === "dark"
                    ? "bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white"
                    : "bg-gradient-to-br from-blue-50 via-white to-indigo-50 text-black"
                }`}
        >
            <div className="max-w-7xl mx-auto px-6">
                <h1 className="text-3xl font-bold mb-6 text-center flex items-center justify-center gap-3">
                    <FaProjectDiagram className="text-blue-600" />
                    Model Comparison
                </h1>

               
                <div className="flex flex-wrap justify-center gap-3 mb-6">
                    <input
                        type="number"
                        placeholder="X value"
                        value={xInput}
                        onChange={(e) => setXInput(e.target.value)}
                        className="border rounded-md px-3 py-2 bg-transparent border-gray-400"
                    />
                    <input
                        type="number"
                        placeholder="Y value"
                        value={yInput}
                        onChange={(e) => setYInput(e.target.value)}
                        className="border rounded-md px-3 py-2 bg-transparent border-gray-400"
                    />
                    <button
                        onClick={addPoint}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                    >
                        Add Point
                    </button>
                    <button
                        onClick={resetPoints}
                        className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                        <FaRedo /> Reset
                    </button>
                </div>

               
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                   
                    <div
                        className={`rounded-xl shadow-lg p-4 border transition-all duration-300 ${theme === "dark"
                                ? "bg-gray-800 border-gray-700"
                                : "bg-white border-gray-200"
                            } ${activeModel === 'linear' ? 'ring-4 ring-blue-500 scale-105' : ''}`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <FaChartLine className="text-blue-500" /> Linear Regression
                            </h2>
                            <button
                                onClick={() => {
                                    toggleAnimation('linear');
                                    highlightModel('linear');
                                }}
                                className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 transition-colors"
                            >
                                {animationState.linear === 'playing' ? <FaPause /> : <FaPlay />}
                            </button>
                        </div>
                        <canvas ref={linearChartRef} height={200}></canvas>

                       
                        <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                            <h3 className="font-semibold flex items-center gap-2 text-blue-300">
                                <FaCalculator /> Regression Calculations
                            </h3>
                            <div className="text-xs space-y-1 mt-2">
                                <p>Slope (m): <span className="text-green-400">{calculations.slope.toFixed(3)}</span></p>
                                <p>Intercept (b): <span className="text-green-400">{calculations.intercept.toFixed(3)}</span></p>
                                <p>Equation: y = {calculations.slope.toFixed(3)}x + {calculations.intercept.toFixed(3)}</p>
                                <p>R²: <span className="text-yellow-400">{calculations.rSquared.toFixed(4)}</span></p>
                                <p>MSE: <span className="text-red-400">{calculations.mse.toFixed(4)}</span></p>
                            </div>
                        </div>
                    </div>

                  
                    <div
                        className={`rounded-xl shadow-lg p-4 border transition-all duration-300 ${theme === "dark"
                                ? "bg-gray-800 border-gray-700"
                                : "bg-white border-gray-200"
                            } ${activeModel === 'nn' ? 'ring-4 ring-yellow-500 scale-105' : ''}`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <FaBrain className="text-yellow-500" /> Neural Network
                            </h2>
                            <button
                                onClick={() => {
                                    toggleAnimation('nn');
                                    highlightModel('nn');
                                }}
                                className="bg-yellow-600 text-white p-2 rounded-md hover:bg-yellow-700 transition-colors"
                            >
                                {animationState.nn === 'playing' ? <FaPause /> : <FaPlay />}
                            </button>
                        </div>
                        <canvas ref={nnChartRef} height={200}></canvas>

                       
                        <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                            <h3 className="font-semibold flex items-center gap-2 text-yellow-300">
                                <FaCalculator /> Activation Functions
                            </h3>
                            <div className="text-xs space-y-1 mt-2">
                                <p className="text-orange-400">Sigmoid: 1 / (1 + e⁻ˣ)</p>
                                <p className="text-purple-400">Tanh: (e²ˣ - 1) / (e²ˣ + 1)</p>
                                <p className="text-red-400">ReLU: max(0, x)</p>
                                <p className="text-gray-400 mt-2">Forward Pass: z = w⋅x + b</p>
                                <p className="text-gray-400">Activation: a = σ(z)</p>
                            </div>
                        </div>
                    </div>

                   
                    <div
                        className={`rounded-xl shadow-lg p-4 border transition-all duration-300 ${theme === "dark"
                                ? "bg-gray-800 border-gray-700"
                                : "bg-white border-gray-200"
                            } ${activeModel === 'cnn' ? 'ring-4 ring-green-500 scale-105' : ''}`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <FaNetworkWired className="text-green-500" /> CNN Feature Map
                            </h2>
                            <button
                                onClick={() => {
                                    toggleAnimation('cnn');
                                    highlightModel('cnn');
                                }}
                                className="bg-green-600 text-white p-2 rounded-md hover:bg-green-700 transition-colors"
                            >
                                {animationState.cnn === 'playing' ? <FaPause /> : <FaPlay />}
                            </button>
                        </div>
                        <canvas ref={cnnChartRef} height={200}></canvas>

                        
                        <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                            <h3 className="font-semibold flex items-center gap-2 text-green-300">
                                <FaCalculator /> CNN Operations
                            </h3>
                            <div className="text-xs space-y-1 mt-2">
                                <p>Convolution: ∑(input × kernel)</p>
                                <p>Pooling: max/avg of local regions</p>
                                <p>Feature Maps: Learned pattern detectors</p>
                                <p className="text-gray-400 mt-2">Kernel Size: 3×3, Stride: 1</p>
                                <p className="text-gray-400">Padding: Same/Valid</p>
                            </div>
                        </div>
                    </div>
                </div>

                
                <div className="grid md:grid-cols-3 gap-6">
                    <div className={`rounded-xl p-5 transition-all duration-300 ${theme === "dark"
                            ? "bg-gray-800 border border-gray-700"
                            : "bg-white border border-gray-200"
                        }`}>
                        <h3 className="text-lg font-semibold text-blue-500 mb-2">Linear Regression</h3>
                        <p className="text-sm mb-3">
                            Finds the best-fit line (Y = mX + b) using Ordinary Least Squares to minimize the sum of squared errors.
                        </p>
                        <div className="text-xs text-gray-400 space-y-1">
                            <p>• Cost Function: MSE = 1/n ∑(yᵢ - ŷᵢ)²</p>
                            <p>• Gradient: ∂/∂m = -2/n ∑xᵢ(yᵢ - ŷᵢ)</p>
                            <p>• Closed Form: m = Σ(x-x̄)(y-ȳ) / Σ(x-x̄)²</p>
                            <p>• R² measures goodness of fit (0-1)</p>
                        </div>
                    </div>

                    <div className={`rounded-xl p-5 transition-all duration-300 ${theme === "dark"
                            ? "bg-gray-800 border border-gray-700"
                            : "bg-white border border-gray-200"
                        }`}>
                        <h3 className="text-lg font-semibold text-yellow-500 mb-2">Neural Network</h3>
                        <p className="text-sm mb-3">
                            Multi-layer perceptron with non-linear activation functions for complex pattern recognition.
                        </p>
                        <div className="text-xs text-gray-400 space-y-1">
                            <p>• Forward: a⁽ˡ⁾ = σ(w⁽ˡ⁾a⁽ˡ⁻¹⁾ + b⁽ˡ⁾)</p>
                            <p>• Backprop: δ⁽ˡ⁾ = (w⁽ˡ⁺¹⁾)ᵀδ⁽ˡ⁺¹⁾ ⊙ σ'(z⁽ˡ⁾)</p>
                            <p>• Update: w = w - η ∇w J(w,b)</p>
                            <p>• Learning rate η controls step size</p>
                        </div>
                    </div>

                    <div className={`rounded-xl p-5 transition-all duration-300 ${theme === "dark"
                            ? "bg-gray-800 border border-gray-700"
                            : "bg-white border border-gray-200"
                        }`}>
                        <h3 className="text-lg font-semibold text-green-500 mb-2">Convolutional Neural Network</h3>
                        <p className="text-sm mb-3">
                            Specialized for spatial data using convolutional layers to detect hierarchical patterns.
                        </p>
                        <div className="text-xs text-gray-400 space-y-1">
                            <p>• Conv: O[i,j] = ∑∑ I[i+m,j+n] ⋅ K[m,n]</p>
                            <p>• Pooling: Reduce spatial dimensions</p>
                            <p>• Feature Hierarchy: Edges → Textures → Objects</p>
                            <p>• Parameter sharing reduces overfitting</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}