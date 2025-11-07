import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "../context/ThemeContext";

type Point = { x: number; y: number };

const PADDING = 48;
const POINT_RADIUS = 5;

function calcRegression(points: Point[]) {
    const n = points.length;
    if (n === 0) return { m: 0, b: 0, error: 0 };
    const sumX = points.reduce((s, p) => s + p.x, 0);
    const sumY = points.reduce((s, p) => s + p.y, 0);
    const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
    const denom = n * sumX2 - sumX * sumX;
    const m = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    const b = (sumY - m * sumX) / n;
    const error = points.reduce((e, p) => {
        const pred = m * p.x + b;
        return e + (p.y - pred) ** 2;
    }, 0);
    return { m, b, error };
}


function generateRandomPoints(count: number = 12): Point[] {
    const points: Point[] = [];
    for (let i = 0; i < count; i++) {
        points.push({
            x: Math.random() * 6, 
            y: Math.random() * 9  
        });
    }
    return points;
}

export default function LinearRegression() {
    const { theme } = useTheme();
    const [points, setPoints] = useState<Point[]>([
        { x: 1, y: 3 },
        { x: 2, y: 5 },
        { x: 3, y: 4 },
        { x: 4, y: 7 },
        { x: 5, y: 8 },
    ]);

    const { m: targetM, b: targetB, error: totalError } = calcRegression(points);


    const [currentM, setCurrentM] = useState<number>(targetM);
    const [currentB, setCurrentB] = useState<number>(targetB);

    const [manualM, setManualM] = useState<number | null>(null);
    const [manualB, setManualB] = useState<number | null>(null);

    const [isAnimatingLine, setIsAnimatingLine] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isAddingPoint, setIsAddingPoint] = useState(false);
    const [animSpeed, setAnimSpeed] = useState(40);
    const [showResiduals, setShowResiduals] = useState(true);


    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [hoverIdx] = useState<number | null>(null);


    const [animationPoints, setAnimationPoints] = useState<Point[]>([]);
    const [currentAnimationStep, setCurrentAnimationStep] = useState(0);

    const getDomain = useCallback(() => {
        const currentPoints = points;

        if (currentPoints.length === 0) return { xmin: 0, xmax: 10, ymin: 0, ymax: 10 };
        const xs = currentPoints.map((p) => p.x);
        const ys = currentPoints.map((p) => p.y);
        let xmin = Math.min(...xs);
        let xmax = Math.max(...xs);
        let ymin = Math.min(...ys);
        let ymax = Math.max(...ys);

        const xpad = Math.max(1, (xmax - xmin) * 0.15);
        const ypad = Math.max(1, (ymax - ymin) * 0.15);
        xmin = Math.floor(xmin - xpad);
        xmax = Math.ceil(xmax + xpad);
        ymin = Math.floor(ymin - ypad);
        ymax = Math.ceil(ymax + ypad);

        if (Math.abs(xmax - xmin) < 1e-6) { xmax = xmin + 5; }
        if (Math.abs(ymax - ymin) < 1e-6) { ymax = ymin + 5; }
        return { xmin, xmax, ymin, ymax };
    }, [points]);


    function dataToPixel(x: number, y: number, width: number, height: number) {
        const { xmin, xmax, ymin, ymax } = getDomain();
        const px = PADDING + ((x - xmin) / (xmax - xmin)) * (width - 2 * PADDING);
        const py = height - PADDING - ((y - ymin) / (ymax - ymin)) * (height - 2 * PADDING);
        return { px, py };
    }

    function pixelToData(px: number, py: number, width: number, height: number) {
        const { xmin, xmax, ymin, ymax } = getDomain();
        const x = xmin + ((px - PADDING) / (width - 2 * PADDING)) * (xmax - xmin);
        const y = ymin + ((height - PADDING - py) / (height - 2 * PADDING)) * (ymax - ymin);
        return { x, y };
    }


    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const DPR = window.devicePixelRatio || 1;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (canvas.width !== Math.floor(width * DPR) || canvas.height !== Math.floor(height * DPR)) {
            canvas.width = Math.floor(width * DPR);
            canvas.height = Math.floor(height * DPR);
        }
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = theme === "dark" ? "#1f2937" : "#fff";
        ctx.fillRect(0, 0, width, height);

        const { xmin, xmax, ymin, ymax } = getDomain();

        const xRange = xmax - xmin;
        const yRange = ymax - ymin;
        const xIncrement = Math.pow(10, Math.floor(Math.log10(xRange))) / 2;
        const yIncrement = Math.pow(10, Math.floor(Math.log10(yRange))) / 2;

        ctx.strokeStyle = theme === "dark" ? "#374151" : "#e6e6e6";
        ctx.lineWidth = 1;
        ctx.fillStyle = theme === "dark" ? "#9ca3af" : "#6b7280";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for (let x = Math.ceil(xmin / xIncrement) * xIncrement; x <= xmax; x += xIncrement) {
            const { px } = dataToPixel(x, 0, width, height);
            ctx.beginPath();
            ctx.moveTo(px, PADDING);
            ctx.lineTo(px, height - PADDING);
            ctx.stroke();
            ctx.fillText(x.toFixed(1), px, height - PADDING + 15);
        }

        for (let y = Math.ceil(ymin / yIncrement) * yIncrement; y <= ymax; y += yIncrement) {
            const { py } = dataToPixel(0, y, width, height);
            ctx.beginPath();
            ctx.moveTo(PADDING, py);
            ctx.lineTo(width - PADDING, py);
            ctx.stroke();
            ctx.fillText(y.toFixed(1), PADDING - 15, py);
        }

        ctx.strokeStyle = theme === "dark" ? "#d1d5db" : "#222";
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(PADDING, height - PADDING);
        ctx.lineTo(width - PADDING, height - PADDING);
        ctx.moveTo(PADDING, PADDING);
        ctx.lineTo(PADDING, height - PADDING);
        ctx.stroke();

        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

       
        if (isAnimating && animationPoints.length > 0 && currentAnimationStep > 0) {
          
            ctx.strokeStyle = "#10b981"; 
            ctx.lineWidth = 2;
            ctx.setLineDash([]);

         
            for (let i = 0; i < currentAnimationStep && i < animationPoints.length - 1; i++) {
                const p1 = animationPoints[i];
                const p2 = animationPoints[i + 1];
                const { px: px1, py: py1 } = dataToPixel(p1.x, p1.y, width, height);
                const { px: px2, py: py2 } = dataToPixel(p2.x, p2.y, width, height);

                ctx.beginPath();
                ctx.moveTo(px1, py1);
                ctx.lineTo(px2, py2);
                ctx.stroke();
            }

            
            animationPoints.forEach((p, i) => {
                if (i <= currentAnimationStep) {
                    const { px, py } = dataToPixel(p.x, p.y, width, height);
                    ctx.beginPath();
                    ctx.fillStyle = i === currentAnimationStep ? "#f59e0b" : "#10b981"; // Current point in orange
                    ctx.arc(px, py, POINT_RADIUS, 0, Math.PI * 2);
                    ctx.fill();

        
                    ctx.fillStyle = theme === "dark" ? "#f3f4f6" : "#111827";
                    ctx.font = "10px sans-serif";
                    ctx.fillText(`(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`, px + 8, py - 8);
                }
            });
        } else {
           
            if (showResiduals) {
                points.forEach((p) => {
                    const predictedY = currentM * p.x + currentB;
                    const { px: px1, py: py1 } = dataToPixel(p.x, p.y, width, height);
                    const { px: px2, py: py2 } = dataToPixel(p.x, predictedY, width, height);
                    ctx.beginPath();
                    ctx.setLineDash([6, 6]);
                    ctx.strokeStyle = theme === "dark" ? "#10b981" : "green";
                    ctx.lineWidth = 1.5;
                    ctx.moveTo(px1, py1);
                    ctx.lineTo(px2, py2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                });
            }

           
            const leftData = pixelToData(PADDING, 0, width, height).x;
            const rightData = pixelToData(width - PADDING, 0, width, height).x;
            const yLeft = currentM * leftData + currentB;
            const yRight = currentM * rightData + currentB;
            const { px: lpx, py: lpy } = dataToPixel(leftData, yLeft, width, height);
            const { px: rpx, py: rpy } = dataToPixel(rightData, yRight, width, height);
            ctx.beginPath();
            ctx.strokeStyle = theme === "dark" ? "#ef4444" : "red";
            ctx.lineWidth = 2.5;
            ctx.moveTo(lpx, lpy);
            ctx.lineTo(rpx, rpy);
            ctx.stroke();

           
            points.forEach((p, i) => {
                const { px, py } = dataToPixel(p.x, p.y, width, height);
                ctx.beginPath();
                ctx.fillStyle = i === hoverIdx
                    ? (theme === "dark" ? "#f59e0b" : "#ff8c00")
                    : (theme === "dark" ? "#3b82f6" : "#2563eb");
                ctx.arc(px, py, POINT_RADIUS, 0, Math.PI * 2);
                ctx.fill();
            });
        }

    
        ctx.fillStyle = theme === "dark" ? "#f3f4f6" : "#111827";
        ctx.font = "14px sans-serif";
        ctx.fillText(`y = ${currentM.toFixed(4)} x + ${currentB.toFixed(4)}`, PADDING + 2, 20);
        ctx.fillStyle = theme === "dark" ? "#9ca3af" : "#6b7280";
        ctx.font = "12px sans-serif";
        ctx.fillText(`Total Error (Sum of Squared Residuals): ${totalError.toFixed(4)}`, PADDING + 2, 38);

      
        if (hoverIdx !== null && !isAnimating) {
            const p = points[hoverIdx];
            const { px, py } = dataToPixel(p.x, p.y, width, height);

            const line1 = `Regression Line: ${(currentM * p.x + currentB).toFixed(4)}`;
            const lines = points.map((pt, i) => {
                const residual = pt.y - (currentM * pt.x + currentB);
                return `Residual ${i}: ${residual.toFixed(4)}`;
            });
            const allLines = [line1, ...lines];

            ctx.font = "12px sans-serif";
            const textWidth = Math.max(...allLines.map(line => ctx.measureText(line).width));
            const boxWidth = textWidth + 20;
            const boxHeight = allLines.length * 18 + 10;

            let boxX = px + 15;
            let boxY = py - boxHeight / 2;

            if (boxX + boxWidth > width - PADDING) {
                boxX = px - boxWidth - 15;
            }

            if (boxY < PADDING) {
                boxY = PADDING;
            }
            if (boxY + boxHeight > height - PADDING) {
                boxY = height - PADDING - boxHeight;
            }

            ctx.fillStyle = theme === "dark" ? "rgba(31, 41, 55, 0.95)" : "rgba(255, 255, 255, 0.95)";
            ctx.strokeStyle = theme === "dark" ? "#6b7280" : "#999";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.rect(boxX, boxY, boxWidth, boxHeight);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = theme === "dark" ? "#ef4444" : "red";
            ctx.fillText(allLines[0], boxX + 10, boxY + 18);

            ctx.fillStyle = theme === "dark" ? "#10b981" : "green";
            for (let i = 1; i < allLines.length; i++) {
                ctx.fillText(allLines[i], boxX + 10, boxY + 18 + i * 18);
            }
        }
    }, [points, currentM, currentB, getDomain, hoverIdx, showResiduals, totalError, theme, isAnimating, animationPoints, currentAnimationStep]);


    useEffect(() => {
        if (!manualM && !manualB) {
            setCurrentM(targetM);
            setCurrentB(targetB);
        }
    }, [targetM, targetB, manualM, manualB]);

   
    useEffect(() => {
        if (!isAnimatingLine) return;


        const randomPoints = generateRandomPoints(12);
        setAnimationPoints(randomPoints);
        setCurrentAnimationStep(0);
        setShowResiduals(false);
        setIsAnimating(true);

        const totalSteps = randomPoints.length - 1;
        const stepDuration = Math.max(100, 3000 - animSpeed * 25); 

        let currentStep = 0;

        const animateStep = () => {
            if (currentStep <= totalSteps) {
                setCurrentAnimationStep(currentStep);
                currentStep++;
                setTimeout(animateStep, stepDuration);
            } else {
               
                const { m: finalM, b: finalB } = calcRegression(randomPoints);
                setCurrentM(finalM);
                setCurrentB(finalB);

                setTimeout(() => {
                    setIsAnimating(false);
                    setIsAnimatingLine(false);
                    setShowResiduals(true);
                    setAnimationPoints([]);
                }, 500);
            }
        };

        animateStep();

        return () => {
            
        };
    }, [isAnimatingLine, animSpeed]);

    useEffect(() => {
        draw();
    }, [draw]);

 
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = () => canvas.getBoundingClientRect();

        const onMove = (e: MouseEvent) => {
            if (isAnimating) return; 

            const r = rect();
            const px = e.clientX - r.left;
            const py = e.clientY - r.top;

            const width = canvas.clientWidth;
            const height = canvas.clientHeight;

            if (px < PADDING || px > width - PADDING || py < PADDING || py > height - PADDING) {
                draw();
                return;
            }

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            draw();

            const { x: dataX } = pixelToData(px, py, width, height);
            const predictedY = currentM * dataX + currentB;

            const residuals = points.map((p, i) => {
                const hoverPred = currentM * dataX + currentB;
                const diff = p.y - hoverPred;
                return `Residual ${i}: ${diff.toFixed(4)}`;
            });

            const lines = [
                `x: ${dataX.toFixed(3)}`,
                `Regression Line: ${predictedY.toFixed(4)}`,
                ...residuals
            ];

            ctx.font = "12px sans-serif";
            const textWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
            const boxWidth = textWidth + 20;
            const boxHeight = lines.length * 18 + 10;

            let boxX = px + 20;
            let boxY = py - boxHeight / 2;

            if (boxX + boxWidth > width - PADDING) boxX = px - boxWidth - 20;
            if (boxY < PADDING) boxY = PADDING;
            if (boxY + boxHeight > height - PADDING) boxY = height - PADDING - boxHeight;

            ctx.fillStyle = theme === "dark"
                ? "rgba(31,41,55,0.95)"
                : "rgba(255,255,255,0.95)";
            ctx.strokeStyle = theme === "dark" ? "#6b7280" : "#999";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.rect(boxX, boxY, boxWidth, boxHeight);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = theme === "dark" ? "#9ca3af" : "#111827";
            ctx.fillText(lines[0], boxX + 10, boxY + 18);

            ctx.fillStyle = theme === "dark" ? "#ef4444" : "red";
            ctx.fillText(lines[1], boxX + 10, boxY + 36);

            ctx.fillStyle = theme === "dark" ? "#10b981" : "green";
            for (let i = 2; i < lines.length; i++) {
                ctx.fillText(lines[i], boxX + 10, boxY + 18 + i * 18);
            }
        };

        const onLeave = () => draw();

        canvas.addEventListener("mousemove", onMove);
        canvas.addEventListener("mouseleave", onLeave);

        return () => {
            canvas.removeEventListener("mousemove", onMove);
            canvas.removeEventListener("mouseleave", onLeave);
        };
    }, [points, currentM, currentB, theme, draw, isAnimating]);

    useEffect(() => {
        if (manualM !== null) setCurrentM(manualM);
    }, [manualM]);

    useEffect(() => {
        if (manualB !== null) setCurrentB(manualB);
    }, [manualB]);

    const addPointFromInputs = () => {
        const xEl = document.getElementById("inpX") as HTMLInputElement;
        const yEl = document.getElementById("inpY") as HTMLInputElement;
        const x = parseFloat(xEl.value || "");
        const y = parseFloat(yEl.value || "");

        if (Number.isFinite(x) && Number.isFinite(y)) {
            setPoints((p) => [...p, { x, y }]);
            setManualM(null);
            setManualB(null);
            setShowResiduals(true);
            setIsAddingPoint(true);

            xEl.value = "";
            yEl.value = "";
        }
    };

    const clearPoints = () => {
        setPoints([]);
        setManualM(null);
        setManualB(null);
        setCurrentM(0);
        setCurrentB(0);
        setAnimationPoints([]);
        setIsAnimating(false);
    };

    useEffect(() => {
        if (!isAddingPoint) return;

        let opacity = 1;
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;

        const duration = 400;
        const start = performance.now();

        const step = (t: number) => {
            const progress = (t - start) / duration;
            opacity = 1 - progress;
            draw();

            if (ctx && points.length) {
                const last = points[points.length - 1];
                const { px, py } = dataToPixel(last.x, last.y, canvasRef.current!.clientWidth, canvasRef.current!.clientHeight);
                ctx.beginPath();
                ctx.arc(px, py, POINT_RADIUS + 2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(59,130,246,${opacity})`;
                ctx.fill();
            }

            if (progress < 1) requestAnimationFrame(step);
            else setIsAddingPoint(false);
        };

        requestAnimationFrame(step);
    }, [isAddingPoint, points, draw]);

    return (
        <div className={`p-6 space-y-6 mt-10 ${theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
            <h1 className={`text-2xl font-bold max-w-2xl text-center mx-auto leading-relaxed ${theme === "dark"
                ? "text-white/70 bg-gradient-to-r from-white/5 to-transparent p-8 rounded-3xl border border-white/10"
                : "text-black/70 bg-gradient-to-r from-black/5 to-transparent p-8 rounded-3xl border border-black/10"
                }`}>
                Animated Linear Regression
            </h1>

            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                <div className={`md:col-span-2 p-4 border rounded-lg ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h2 className="text-lg font-semibold">Regression Equation</h2>
                        </div>

                        <div className={`text-right text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                            Points: <span className={`font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                                {points.length}
                            </span>
                            {isAnimating && <span className="ml-2 text-green-500">(Animating...)</span>}
                        </div>
                    </div>

                    <div className="relative">
                        <canvas
                            ref={canvasRef}
                            style={{ width: "100%", height: 420 }}
                            className={`w-full rounded border cursor-crosshair ${theme === "dark" ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"}`}
                        />
                    </div>
                </div>

                <div className="space-y-4 md:col-span-1">
                    <div
                        className={`p-4 border rounded-lg ${theme === "dark"
                            ? "bg-gray-800 border-gray-700 text-white"
                            : "bg-white border-gray-300 text-gray-900"
                            }`}
                    >
                        <h3 className="font-semibold mb-2">How the Best Fit Line Works</h3>

                        <ol
                            className={`list-decimal ml-4 text-sm space-y-2 ${theme === "dark" ? "text-gray-300" : "text-gray-600"
                                }`}
                        >
                            <li>
                                <strong>Calculate mean of X and Y</strong> – Find the "center" of
                                the data.
                            </li>
                            <li>
                                <strong>Calculate slope</strong> – Using the formula: slope =
                                Σ(x - x̄)(y - ȳ) / Σ(x - x̄)²
                            </li>
                            <li>
                                <strong>Calculate y-intercept</strong> – Using the formula:
                                intercept = ȳ − (slope × x̄)
                            </li>
                            <li>
                                <strong>Minimize residuals</strong> – The green dotted lines show
                                the errors (distances) between actual and predicted values.
                            </li>
                            <li>
                                <strong>Sum of squared errors</strong> – The optimal line
                                minimizes the sum of these squared errors.
                            </li>
                        </ol>
                    </div>

                    <div className={`p-4 border rounded-lg ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                        <h3 className="font-semibold mb-2">Data Points</h3>
                        <div className="flex gap-2 mb-3">
                            <input
                                id="inpX"
                                placeholder="X value"
                                className={`border p-2 rounded w-full ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300"}`}
                            />
                            <input
                                id="inpY"
                                placeholder="Y value"
                                className={`border p-2 rounded w-full ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300"}`}
                            />
                        </div>
                        <div className="flex gap-2 mb-3">
                            <button onClick={addPointFromInputs} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full transition-colors">
                                Add Point
                            </button>
                            <button onClick={clearPoints} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded w-full transition-colors">
                                Clear Data
                            </button>
                        </div>

                        <div className={`h-40 overflow-auto border rounded ${theme === "dark" ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"}`}>
                            <table className="w-full text-sm">
                                <thead className={`sticky top-0 ${theme === "dark" ? "bg-gray-600" : "bg-gray-50"}`}>
                                    <tr className={theme === "dark" ? "text-gray-200" : "text-gray-600"}>
                                        <th className="text-left px-2 py-1">X</th>
                                        <th className="text-left px-2 py-1">Y</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {points.map((p, i) => (
                                        <tr key={i} className={theme === "dark" ? "border-gray-600" : "border-gray-200"}>
                                            <td className={`px-2 py-1 border-t ${theme === "dark" ? "border-gray-600" : "border-gray-200"}`}>{p.x}</td>
                                            <td className={`px-2 py-1 border-t ${theme === "dark" ? "border-gray-600" : "border-gray-200"}`}>{p.y}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className={`p-4 border rounded-lg space-y-3 ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                        <button
                            onClick={() => {
                                setIsAnimatingLine(true);
                                setManualM(null);
                                setManualB(null);
                            }}
                            disabled={isAnimatingLine}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded w-full disabled:bg-gray-500 transition-colors"
                        >
                            {isAnimating ? "Animating..." : "Animate BFL"}
                        </button>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showResiduals}
                                onChange={(e) => setShowResiduals(e.target.checked)}
                                className="rounded"
                            />
                            <span className="text-sm">Show Residuals</span>
                        </label>

                        <div>
                            <div className="text-sm mb-1 flex justify-between">
                                <span>Animation Speed:</span>
                                <span className="font-medium">{animSpeed}</span>
                            </div>
                            <input
                                type="range"
                                min={1}
                                max={100}
                                value={animSpeed}
                                onChange={(e) => setAnimSpeed(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <div className="text-sm mb-1 flex justify-between">
                                <span>Manual Slope (m):</span>
                                <span className="font-medium">{(manualM ?? currentM).toFixed(2)}</span>
                            </div>
                            <input
                                type="range"
                                min={-5}
                                max={5}
                                step={0.01}
                                value={manualM ?? currentM}
                                onChange={(e) => {
                                    setManualM(Number(e.target.value));
                                    setIsAnimating(false);
                                }}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <div className="text-sm mb-1 flex justify-between">
                                <span>Manual Intercept (b):</span>
                                <span className="font-medium">{(manualB ?? currentB).toFixed(2)}</span>
                            </div>
                            <input
                                type="range"
                                min={-10}
                                max={10}
                                step={0.01}
                                value={manualB ?? currentB}
                                onChange={(e) => {
                                    setManualB(Number(e.target.value));
                                    setIsAnimating(false);
                                }}
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}