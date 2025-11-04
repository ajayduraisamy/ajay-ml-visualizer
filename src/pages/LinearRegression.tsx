// src/pages/LinearRegression.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import {
    Chart as ChartJS,
    LineElement,
    PointElement,
    LinearScale,
    Title,
    Tooltip,
    Legend,
    CategoryScale,
} from "chart.js";
import { Scatter } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, LinearScale, Title, Tooltip, Legend, CategoryScale);

type Point = { x: number; y: number };

const LinearRegression: React.FC = () => {
    const [dataPoints, setDataPoints] = useState<Point[]>([
        { x: 1, y: 3 },
        { x: 2, y: 5 },
        { x: 3, y: 4 },
        { x: 4, y: 7 },
        { x: 5, y: 8 },
    ]);
    const [regression, setRegression] = useState({ slope: 0, intercept: 0, totalError: 0 });
    const [xValue, setXValue] = useState("");
    const [yValue, setYValue] = useState("");
    const [animationSpeed, setAnimationSpeed] = useState(50);
    const [showResiduals, setShowResiduals] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Calculate regression line
    const calculateRegression = useCallback(() => {
        const n = dataPoints.length;
        const meanX = dataPoints.reduce((sum, p) => sum + p.x, 0) / n;
        const meanY = dataPoints.reduce((sum, p) => sum + p.y, 0) / n;
        let numerator = 0;
        let denominator = 0;

        dataPoints.forEach((p) => {
            numerator += (p.x - meanX) * (p.y - meanY);
            denominator += (p.x - meanX) ** 2;
        });

        const slope = numerator / denominator;
        const intercept = meanY - slope * meanX;

        const totalError = dataPoints.reduce((err, p) => {
            const predicted = slope * p.x + intercept;
            return err + (p.y - predicted) ** 2;
        }, 0);

        setRegression({ slope, intercept, totalError });
    }, [dataPoints]);

    useEffect(() => {
        calculateRegression();
    }, [dataPoints, calculateRegression]);

    // Chart data
    const scatterData = {
        datasets: [
            {
                label: "Regression Line",
                data: dataPoints.map((p) => ({
                    x: p.x,
                    y: regression.slope * p.x + regression.intercept,
                })),
                borderColor: "red",
                borderWidth: 2,
                showLine: true,
                pointRadius: 0,
            },
            {
                label: "Data Points",
                data: dataPoints,
                backgroundColor: "blue",
            },
            ...(showResiduals
                ? [
                    {
                        label: "Residuals",
                        data: dataPoints.map((p) => ({
                            x: p.x,
                            y: p.y,
                        })),
                        pointStyle: "rectRot",
                        backgroundColor: "green",
                    },
                ]
                : []),
        ],
    };

    const handleAddPoint = () => {
        if (xValue && yValue) {
            setDataPoints([...dataPoints, { x: parseFloat(xValue), y: parseFloat(yValue) }]);
            setXValue("");
            setYValue("");
        }
    };

    const handleClear = () => {
        setDataPoints([]);
    };

    const handleAnimate = () => {
        setShowResiduals((prev) => !prev);
    };

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold">Animated Linear Regression</h1>

            <div
                className={`grid md:grid-cols-3 gap-6`}
            >
                {/* Left Panel */}
                <div className="md:col-span-2 p-6 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
                    <h2 className="text-lg font-semibold">Regression Equation</h2>
                    <p className="text-gray-600 dark:text-gray-300">
                        y = {regression.slope.toFixed(4)} × x + {regression.intercept.toFixed(4)}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                        Total Error (Sum of Squared Residuals): {regression.totalError.toFixed(4)}
                    </p>

                    <div className="mt-4 bg-white rounded p-3">
                        <Scatter
                            data={scatterData}
                            options={{
                                responsive: true,
                                scales: {
                                    x: { min: 0, max: 8, ticks: { stepSize: 1 } },
                                    y: { min: 0, max: 8, ticks: { stepSize: 1 } },
                                },
                                plugins: {
                                    legend: { display: false },
                                },
                            }}
                        />
                    </div>
                </div>

                {/* Right Panel */}
                <div className="space-y-4">
                    <div className="p-6 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
                        <h2 className="font-semibold mb-3">How the Best Fit Line Works</h2>
                        <ol className="list-decimal ml-4 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                            <li>Calculate mean of X and Y - Find the “center” of the data.</li>
                            <li>Calculate slope - Using the formula slope = Σ(x-x̄)(y-ȳ) / Σ(x-x̄)².</li>
                            <li>Calculate y-intercept - Using the formula: intercept = ȳ - slope × x̄.</li>
                            <li>Minimize residuals - Green dotted lines show distances between actual and predicted values.</li>
                            <li>Sum of squared errors - Optimal line minimizes these squared errors.</li>
                        </ol>
                    </div>

                    <div className="p-6 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
                        <h2 className="font-semibold mb-3">Data Points</h2>
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="text-gray-600 dark:text-gray-300">
                                    <th className="px-2">X</th>
                                    <th className="px-2">Y</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dataPoints.map((p, i) => (
                                    <tr key={i}>
                                        <td className="px-2">{p.x}</td>
                                        <td className="px-2">{p.y}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Bottom Controls */}
            <div className="p-6 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
                <div className="flex flex-wrap gap-3 items-center">
                    <input
                        type="number"
                        placeholder="X value"
                        value={xValue}
                        onChange={(e) => setXValue(e.target.value)}
                        className="border p-2 rounded w-24"
                    />
                    <input
                        type="number"
                        placeholder="Y value"
                        value={yValue}
                        onChange={(e) => setYValue(e.target.value)}
                        className="border p-2 rounded w-24"
                    />
                    <button
                        onClick={handleAddPoint}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        Add Point
                    </button>
                    <button
                        onClick={handleClear}
                        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                    >
                        Clear Data
                    </button>
                    <button
                        onClick={handleAnimate}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                        Animate BFL
                    </button>
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                        Animation Speed:
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="100"
                        value={animationSpeed}
                        onChange={(e) => setAnimationSpeed(Number(e.target.value))}
                        className="w-full"
                    />
                    <div className="text-sm text-gray-500">
                        {animationSpeed < 50 ? "Fast" : "Slow"}
                    </div>
                </div>
            </div>

          
        </div>
    );
};

export default LinearRegression;
