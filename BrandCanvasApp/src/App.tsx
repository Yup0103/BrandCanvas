import { BrowserRouter, Routes, Route } from "react-router-dom";
import BrandCanvas from './pages/BrandCanvas';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const App = () => (
    <TooltipProvider>
        <Toaster />
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<BrandCanvas />} />
                <Route path="/brand-canvas" element={<BrandCanvas />} />
            </Routes>
        </BrowserRouter>
    </TooltipProvider>
);

export default App; 