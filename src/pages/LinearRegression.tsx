import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "../context/ThemeContext";
/**
 * Canvas Linear Regression Visualiser
 * - React + TypeScript + Tailwind
 * - Click canvas to add points
 * - Sliders for slope & intercept (manual)
 * - Animate button: animates current (m,b) -> computed best-fit (m*, b*)
 * - Residual dashed lines update live during animation
 * - MODIFIED: Hover tooltip is now drawn ON THE CANVAS
 * - MODIFIED: Animation is now an "elliptical spiral"
 */

type Point = { x: number; y: number };

const PADDING = 48; // canvas padding for axes area
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

    // current displayed line (animated / controlled)
    const [currentM, setCurrentM] = useState<number>(targetM);
    const [currentB, setCurrentB] = useState<number>(targetB);

    // manual controls override animation
    const [manualM, setManualM] = useState<number | null>(null);
    const [manualB, setManualB] = useState<number | null>(null);

    const [isAnimating, setIsAnimating] = useState(false);
    const [animSpeed, setAnimSpeed] = useState(40); // 1..100
    const [showResiduals, setShowResiduals] = useState(true);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rafRef = useRef<number | null>(null);

    // hover tooltip
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    // autoscale domain
    const getDomain = useCallback(() => {
        if (points.length === 0) return { xmin: 0, xmax: 10, ymin: 0, ymax: 10 };
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        let xmin = Math.min(...xs);
        let xmax = Math.max(...xs);
        let ymin = Math.min(...ys);
        let ymax = Math.max(...ys);
        // pad
        const xpad = Math.max(1, (xmax - xmin) * 0.15);
        const ypad = Math.max(1, (ymax - ymin) * 0.15);
        xmin = xmin - xpad;
        xmax = xmax + xpad;
        ymin = ymin - ypad;
        ymax = ymax + ypad;
        // if flat, expand
        if (Math.abs(xmax - xmin) < 1e-6) { xmax = xmin + 5; }
        if (Math.abs(ymax - ymin) < 1e-6) { ymax = ymin + 5; }
        return { xmin, xmax, ymin, ymax };
    }, [points]);

    // mapping functions between data and pixels
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

    // draw function
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

        // background
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);

        // grid
        ctx.strokeStyle = "#e6e6e6";
        ctx.lineWidth = 1;
        const xSteps = 8;
        const ySteps = 8;
        for (let i = 0; i <= xSteps; i++) {
            const x = PADDING + (i / xSteps) * (width - 2 * PADDING);
            ctx.beginPath();
            ctx.moveTo(x, PADDING);
            ctx.lineTo(x, height - PADDING);
            ctx.stroke();
        }
        for (let j = 0; j <= ySteps; j++) {
            const y = PADDING + (j / ySteps) * (height - 2 * PADDING);
            ctx.beginPath();
            ctx.moveTo(PADDING, y);
            ctx.lineTo(width - PADDING, y);
            ctx.stroke();
        }

        // axes
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        // x axis
        ctx.moveTo(PADDING, height - PADDING);
        ctx.lineTo(width - PADDING, height - PADDING);
        // y axis
        ctx.moveTo(PADDING, PADDING);
        ctx.lineTo(PADDING, height - PADDING);
        ctx.stroke();

        // draw residual dashed lines if enabled
        if (showResiduals) {
            points.forEach((p) => {
                const predictedY = currentM * p.x + currentB;
                const { px: px1, py: py1 } = dataToPixel(p.x, p.y, width, height);
                const { px: px2, py: py2 } = dataToPixel(p.x, predictedY, width, height);
                ctx.beginPath();
                ctx.setLineDash([6, 6]);
                ctx.strokeStyle = "green";
                ctx.lineWidth = 1.5;
                ctx.moveTo(px1, py1);
                ctx.lineTo(px2, py2);
                ctx.stroke();
                ctx.setLineDash([]);
            });

        }

        // draw regression line (red) across domain
        {
            const leftData = pixelToData(PADDING, 0, width, height).x;
            const rightData = pixelToData(width - PADDING, 0, width, height).x;
            const yLeft = currentM * leftData + currentB;
            const yRight = currentM * rightData + currentB;
            const { px: lpx, py: lpy } = dataToPixel(leftData, yLeft, width, height);
            const { px: rpx, py: rpy } = dataToPixel(rightData, yRight, width, height);
            ctx.beginPath();
            ctx.strokeStyle = "red";
            ctx.lineWidth = 2.5;
            ctx.moveTo(lpx, lpy);
            ctx.lineTo(rpx, rpy);
            ctx.stroke();
        }

        // draw points on top
        points.forEach((p, i) => {
            const { px, py } = dataToPixel(p.x, p.y, width, height);
            ctx.beginPath();
            ctx.fillStyle = i === hoverIdx ? "#ff8c00" : "#2563eb"; // hover highlight
            ctx.arc(px, py, POINT_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        });

        // labels: equation & total error top-left
        ctx.fillStyle = "#111827";
        ctx.font = "14px sans-serif";
        ctx.fillText(`y = ${currentM.toFixed(4)} x + ${currentB.toFixed(4)}`, PADDING + 2, 20);
        ctx.fillStyle = "#6b7280";
        ctx.font = "12px sans-serif";
        ctx.fillText(`Total Error (Sum of Squared Residuals): ${totalError.toFixed(4)}`, PADDING + 2, 38);

        // --- MODIFIED --- Draw tooltip on canvas if hovering
        if (hoverIdx !== null) {
            const p = points[hoverIdx];
            const { px, py } = dataToPixel(p.x, p.y, width, height);

            // Tooltip text
            const line1 = `Regression Line: ${(currentM * p.x + currentB).toFixed(4)}`;
            const lines = points.map((pt, i) => {
                const residual = pt.y - (currentM * pt.x + currentB);
                return `Residual ${i}: ${residual.toFixed(4)}`;
            });
            const allLines = [line1, ...lines];

            // Calculate box size
            ctx.font = "12px sans-serif";
            const textWidth = Math.max(...allLines.map(line => ctx.measureText(line).width));
            const boxWidth = textWidth + 20;
            const boxHeight = allLines.length * 18 + 10;

            // Position box intelligently: try right, then left
            let boxX = px + 15;
            let boxY = py - boxHeight / 2;

            // If box goes off-screen right, move it to the left
            if (boxX + boxWidth > width - PADDING) {
                boxX = px - boxWidth - 15;
            }
            // If box goes off-screen top/bottom (less likely), adjust
            if (boxY < PADDING) {
                boxY = PADDING;
            }
            if (boxY + boxHeight > height - PADDING) {
                boxY = height - PADDING - boxHeight;
            }


            // Draw box
            ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
            ctx.strokeStyle = "#999";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.rect(boxX, boxY, boxWidth, boxHeight);
            ctx.fill();
            ctx.stroke();

            // Draw text
            ctx.fillStyle = "red";
            ctx.fillText(allLines[0], boxX + 10, boxY + 18);

            ctx.fillStyle = "green";
            for (let i = 1; i < allLines.length; i++) {
                ctx.fillText(allLines[i], boxX + 10, boxY + 18 + i * 18);
            }
        }
    }, [points, currentM, currentB, getDomain, hoverIdx, showResiduals, totalError]);

    // initial set current line to computed line
    useEffect(() => {
        if (!manualM && !manualB) {
            setCurrentM(targetM);
            setCurrentB(targetB);
        }
    }, [targetM, targetB, manualM, manualB]);

    // =================================================================
    // --- THIS IS THE UPDATED "SPIRAL" ANIMATION LOGIC ---
    // =================================================================
    useEffect(() => {
        if (!isAnimating) return;

        const duration = Math.max(80, animSpeed * 8);
        const startTime = performance.now();
        const startM = currentM;
        const startB = currentB;
        const deltaM = targetM - startM;
        const deltaB = targetB - startB;

        const step = (t: number) => {
            const elapsed = t - startTime;
            const norm = Math.min(1, elapsed / duration);

            // Ease in-out cubic (same as before)
            const ease = norm < 0.5 ? 4 * norm * norm * norm : 1 - Math.pow(-2 * norm + 2, 3) / 2;

            // 1. Smooth base movement (same as before)
            const baseM = startM + deltaM * ease;
            const baseB = startB + deltaB * ease;

            // 2. Calculate the shrinking "radius" of the spiral
            // This goes from 1 (start) down to 0 (end)
            const spiralRadius = 1 - ease;

            // 3. Define the angle for the spiral
            // This spins the line around
            const angle = elapsed / 80; // You can change 80 to make it spin faster or slower

            // 4. Calculate the "shape" - an elliptical spiral
            // 'm' (slope) moves with Cosine 
            // 'b' (intercept) moves with Sine
            // This is the "x, y combined" motion.
            const spiralM = Math.cos(angle) * 2.0 * spiralRadius; // 2.0 is the "width" of the spiral
            const spiralB = Math.sin(angle) * 4.0 * spiralRadius; // 4.0 is the "height" of the spiral

            // 5. Combine the base movement with the spiral
            const newM = baseM + spiralM;
            const newB = baseB + spiralB;

            setCurrentM(newM);
            setCurrentB(newB);

            if (norm < 1) {
                rafRef.current = requestAnimationFrame(step);
            } else {
                // settle exactly on target
                setCurrentM(targetM);
                setCurrentB(targetB);
                setIsAnimating(false);
                rafRef.current = null;
            }
        };

        rafRef.current = requestAnimationFrame(step);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAnimating, animSpeed, targetM, targetB]);
    // =================================================================
    // --- END OF UPDATED ANIMATION LOGIC ---
    // =================================================================


    // redraw on changes
    useEffect(() => {
        draw();
    }, [draw]);

    // canvas events
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = () => canvas.getBoundingClientRect();

        const onMove = (e: MouseEvent) => {
            const r = rect();
            const px = e.clientX - r.left;
            const py = e.clientY - r.top;

            // Check if cursor is inside the plotting area
            if (px < PADDING || px > canvas.clientWidth - PADDING || py < PADDING || py > canvas.clientHeight - PADDING) {
                setHoverIdx(null);
                draw();
                return;
            }

            // find nearest point
            let nearest: number | null = null;
            let minD = 9999;
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            points.forEach((p, i) => {
                const { px: cx, py: cy } = dataToPixel(p.x, p.y, width, height);
                const d = Math.hypot(cx - px, cy - py);
                if (d < minD && d < 12) {
                    minD = d;
                    nearest = i;
                }
            });

            // Only update state if hover index changes, to avoid too many re-renders
            setHoverIdx(prevIdx => {
                if (prevIdx !== nearest) {
                    draw(); // Trigger draw on change
                }
                return nearest;
            });
        };

        const onClick = (e: MouseEvent) => {
            const r = rect();
            const px = e.clientX - r.left;
            const py = e.clientY - r.top;

            // Only add point if click is inside the plotting area
            if (px < PADDING || px > canvas.clientWidth - PADDING || py < PADDING || py > canvas.clientHeight - PADDING) {
                return;
            }

            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            const data = pixelToData(px, py, width, height);
            // add new point
            setPoints((prev) => [...prev, { x: Number(data.x.toFixed(4)), y: Number(data.y.toFixed(4)) }]);
            // clear manual overrides when adding point (so animation applies to new regression)
            setManualM(null);
            setManualB(null);
            setTimeout(() => {
                // small delay to let points update and compute regression
                setIsAnimating(true);
                setShowResiduals(true);
            }, 50);
        };

        canvas.addEventListener("mousemove", onMove);
        canvas.addEventListener("mouseleave", () => {
            setHoverIdx(null);
            draw();
        });
        canvas.addEventListener("click", onClick);

        return () => {
            canvas.removeEventListener("mousemove", onMove);
            canvas.removeEventListener("click", onClick);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [points, currentM, currentB, getDomain, draw]); // Added draw to dependency array

    // sliders manual control
    useEffect(() => {
        if (manualM !== null) setCurrentM(manualM);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [manualM]);
    useEffect(() => {
        if (manualB !== null) setCurrentB(manualB);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [manualB]);

    // UI handlers
    const addPointFromInputs = () => {
        const xEl = document.getElementById("inpX") as HTMLInputElement;
        const yEl = document.getElementById("inpY") as HTMLInputElement;
        const x = parseFloat(xEl.value || "");
        const y = parseFloat(yEl.value || "");

        if (Number.isFinite(x) && Number.isFinite(y)) {
            setPoints((p) => [...p, { x, y }]);
            setManualM(null);
            setManualB(null);
            setIsAnimating(true);
            setShowResiduals(true);
            // Clear inputs
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
    };

    return (
        <div className={`p-6 space-y-6 ${theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>

        
            <h1 className="text-2xl font-bold mt-14 text-center">Animated Linear Regression</h1>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Left Chart */}
                <div className={`md:col-span-2 p-4 border rounded-lg ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-black"}`}>

                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h2 className="text-lg font-semibold">Regression Equation</h2>
                            


                        </div>

                        <div className={`text-right text-xs ${theme === "dark" ? "text-white" : "text-gray-500"}`}>
                            Points:{" "}
                            <span className={`font-medium ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                                {points.length}
                            </span>
                        </div>

                    </div>

                    <div className="relative">
                        <canvas
                            ref={canvasRef}
                            style={{ width: "100%", height: 420 }}
                            className="w-full rounded bg-white border cursor-crosshair"
                        />
                    </div>
                </div>

                {/* Right sidebar */}
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

                            <li><strong>Calculate mean of X and Y</strong> – Find the "center" of the data.</li>
                            <li><strong>Calculate slope</strong> – Using the formula: slope = Σ(x - x̄)(y - ȳ) / Σ(x - x̄)²</li>
                            <li><strong>Calculate y-intercept</strong> – Using the formula: intercept = ȳ − (slope × x̄)</li>
                            <li><strong>Minimize residuals</strong> – The green dotted lines show the errors (distances) between actual and predicted values.</li>
                            <li><strong>Sum of squared errors</strong> – The optimal line minimizes the sum of these squared errors.</li>

                        </ol>
                    </div>

                   <div
  className={`p-4 border rounded-lg ${
    theme === "dark"
      ? "bg-gray-800 border-gray-700 text-white"
      : "bg-white border-gray-300 text-gray-900"
  }`}
>
  <h3 className="font-semibold mb-2">Data Points</h3>

  <div className="flex gap-2 mb-3">
    <input
      id="inpX"
      placeholder="X value"
      className={`border p-2 rounded w-full ${
        theme === "dark"
          ? "bg-gray-800 border-gray-700 text-white placeholder-gray-400"
          : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
      }`}
    />
    <input
      id="inpY"
      placeholder="Y value"
      className={`border p-2 rounded w-full ${
        theme === "dark"
          ? "bg-gray-800 border-gray-700 text-white placeholder-gray-400"
          : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
      }`}
    />
  </div>

  <div className="flex gap-2 mb-3">
    <button
      onClick={addPointFromInputs}
      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full transition"
    >
      Add Point
    </button>
    <button
      onClick={clearPoints}
      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded w-full transition"
    >
      Clear Data
    </button>
  </div>


                        <div className="h-40 overflow-auto border rounded">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr className="text-gray-600">
                                        <th className="text-left px-2 py-1">X</th>
                                        <th className="text-left px-2 py-1">Y</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {points.map((p, i) => (
                                        <tr key={i} className="border-t">
                                            <td className="px-2 py-1">{p.x}</td>
                                            <td className="px-2 py-1">{p.y}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div
                        className={`p-4 border rounded-lg space-y-3 ${theme === "dark"
                                ? "bg-gray-800 border-gray-700 text-white"
                                : "bg-white border-gray-300 text-gray-900"
                            }`}
                    >
                        <button
                            onClick={() => {
                                setIsAnimating(true);
                                setShowResiduals(true);
                                setManualM(null);
                                setManualB(null);
                            }}
                            disabled={isAnimating}
                            className="bg-green-600 text-white px-4 py-2 rounded w-full disabled:bg-gray-400 transition hover:bg-green-700"
                        >
                            {isAnimating ? "Animating..." : "Animate BFL"}
                        </button>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showResiduals}
                                onChange={(e) => setShowResiduals(e.target.checked)}
                                className="accent-blue-600"
                            />
                            <span className="text-sm">Show Residuals</span>
                        </label>

                        {/* Animation Speed */}
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
                                className="w-full cursor-pointer accent-green-600"
                            />
                        </div>

                        {/* Manual Slope */}
                        <div>
                            <div className="text-sm mb-1 flex justify-between">
                                <span>Manual Slope (m):</span>
                                <span className="font-medium">
                                    {(manualM ?? currentM).toFixed(2)}
                                </span>
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
                                className="w-full cursor-pointer accent-blue-500"
                            />
                        </div>

                        {/* Manual Intercept */}
                        <div>
                            <div className="text-sm mb-1 flex justify-between">
                                <span>Manual Intercept (b):</span>
                                <span className="font-medium">
                                    {(manualB ?? currentB).toFixed(2)}
                                </span>
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
                                className="w-full cursor-pointer accent-purple-500"
                            />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}