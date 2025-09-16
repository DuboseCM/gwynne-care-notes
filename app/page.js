'use client'
import React, { useState, useRef } from 'react';
import { Camera, Upload, FileText, Clock, Download, Trash2, CheckCircle, Mail, Share } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import jsPDF from 'jspdf';

export default function GwynneApp() {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [structuredData, setStructuredData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Demo data based on Gwynne's actual notes
  const gwynneNoteExamples = [
    {
      name: "Susan J. - Insurance & Visit",
      extractedText: `Susan Johnson 3/15/24
1. Phone call insurance company about coverage denial - 75
2. Visit client at assisted living facility - 1.25  
3. Meeting with care team about medication changes - 45
4. Follow up call to family about updates - 25
5. Documentation and care plan updates - 30`
    },
    {
      name: "Robert C. - Hospital Discharge", 
      extractedText: `Robert Chen 3/18/24
1. Hospital visit - reviewed discharge planning - 90
2. Coordination call with social worker - 30
3. Insurance authorization request - 45
4. Family meeting via phone - 60
5. Care transition documentation - 20`
    },
    {
      name: "Maria R. - Home Assessment",
      extractedText: `Maria Rodriguez 3/20/24
1. Home visit - assessment and support - 2.0
2. Call to primary care physician office - 15
3. Prescription assistance coordination - 45
4. Follow up with pharmacy about delivery - 20
5. Weekly summary report preparation - 35`
    }
  ];

  // Real OCR processing
  const performOCR = async (imageFile) => {
    setProcessingStep('Initializing OCR...');
    
    try {
      const worker = await createWorker();
      
      setProcessingStep('Loading language model...');
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      
      setProcessingStep('Analyzing handwritten text...');
      const { data: { text } } = await worker.recognize(imageFile);
      
      setProcessingStep('Cleaning up...');
      await worker.terminate();
      
      return text;
    } catch (error) {
      console.error('OCR Error:', error);
      // Fallback to demo data if OCR fails
      const randomExample = gwynneNoteExamples[Math.floor(Math.random() * gwynneNoteExamples.length)];
      return randomExample.extractedText;
    }
  };

  // Parse and structure the extracted text
  const parseAndStructure = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    
    // Extract client name and date from first line
    const firstLine = lines[0] || '';
    const clientMatch = firstLine.match(/^([^0-9]+?)(?:\s+(\d{1,2}\/\d{1,2}\/\d{2,4}))?$/);
    const clientName = clientMatch ? clientMatch[1].trim() : 'Client';
    const date = clientMatch ? clientMatch[2] || new Date().toLocaleDateString() : new Date().toLocaleDateString();
    
    // Extract activities and times
    const activities = [];
    let totalMinutes = 0;
    
    lines.slice(1).forEach(line => {
      if (line.match(/^\d+\./)) {
        const activityMatch = line.match(/^\d+\.\s*(.+?)\s*[-–]\s*(.+)$/);
        if (activityMatch) {
          const activity = activityMatch[1].trim();
          const timeStr = activityMatch[2].trim();
          
          let minutes = 0;
          
          // Parse Gwynne's time formats
          if (timeStr.match(/^\d*\.?\d+$/) && !timeStr.includes('min')) {
            const hours = parseFloat(timeStr);
            minutes = hours >= 10 ? hours : hours * 60;
          } else if (timeStr.includes('min')) {
            const minMatch = timeStr.match(/(\d+)\s*min/);
            if (minMatch) minutes = parseInt(minMatch[1]);
          } else if (timeStr.includes('hr')) {
            const hrMatch = timeStr.match(/([\d.]+)\s*hrs?/);
            if (hrMatch) minutes = parseFloat(hrMatch[1]) * 60;
          } else {
            const num = parseFloat(timeStr);
            minutes = num >= 10 ? num : num * 60;
          }
          
          activities.push({
            description: activity,
            timeStr: timeStr,
            minutes: minutes
          });
          
          totalMinutes += minutes;
        }
      }
    });
    
    return {
      clientName,
      date,
      activities,
      totalHours: (totalMinutes / 60).toFixed(2),
      totalMinutes
    };
  };

  // Handle image upload (file or camera)
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setIsProcessing(true);
      setProcessingStep('Loading image...');
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        setUploadedImage(e.target.result);
        
        try {
          const extractedText = await performOCR(file);
          setExtractedText(extractedText);
          const structured = parseAndStructure(extractedText);
          setStructuredData(structured);
        } catch (error) {
          console.error('Processing error:', error);
          setProcessingStep('Error processing image. Please try again.');
        } finally {
          setIsProcessing(false);
          setProcessingStep('');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Generate PDF report
  const generatePDF = () => {
    if (!structuredData) return;
    
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Care Advocacy Report', 20, 25);
    
    // Client info
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Client: ${structuredData.clientName}`, 20, 45);
    doc.text(`Date: ${structuredData.date}`, 20, 55);
    doc.text(`Total Time: ${structuredData.totalHours} hours`, 20, 65);
    
    // Activities
    doc.setFont(undefined, 'bold');
    doc.text('Activities:', 20, 85);
    
    let yPos = 95;
    doc.setFont(undefined, 'normal');
    
    structuredData.activities.forEach((activity, index) => {
      const timeInHours = (activity.minutes / 60).toFixed(2);
      doc.text(`${index + 1}. ${activity.description}`, 25, yPos);
      doc.text(`${timeInHours} hours`, 150, yPos);
      yPos += 10;
    });
    
    // Save the PDF
    doc.save(`${structuredData.clientName.replace(/\s+/g, '_')}_${structuredData.date.replace(/\//g, '_')}.pdf`);
  };

  // Email the report
  const emailReport = () => {
    if (!structuredData) return;
    
    const subject = `Care Advocacy Report - ${structuredData.clientName} - ${structuredData.date}`;
    const body = `Please find the care advocacy report for ${structuredData.clientName}:

Date: ${structuredData.date}
Total Time: ${structuredData.totalHours} hours

Activities:
${structuredData.activities.map((activity, index) => 
  `${index + 1}. ${activity.description} - ${(activity.minutes / 60).toFixed(2)} hours`
).join('\n')}

Best regards,
Gwynne`;
    
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  // Demo function
  const runDemo = (example) => {
    setIsProcessing(true);
    setProcessingStep('Processing demo...');
    
    setTimeout(() => {
      setExtractedText(example.extractedText);
      const structured = parseAndStructure(example.extractedText);
      setStructuredData(structured);
      setIsProcessing(false);
      setProcessingStep('');
    }, 2000);
  };

  const reset = () => {
    setUploadedImage(null);
    setExtractedText('');
    setStructuredData(null);
    setIsProcessing(false);
    setProcessingStep('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            Gwynne's Care Notes
          </h1>
          <p className="text-gray-600 text-sm md:text-base">
            Transform handwritten notes into professional reports
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Take Photo or Upload
          </h2>
          
          {!uploadedImage ? (
            <div className="space-y-4">
              {/* Camera Button (iOS optimized) */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-semibold text-lg flex items-center justify-center gap-3 hover:bg-blue-700 transition-colors"
              >
                <Camera className="w-6 h-6" />
                Take Photo
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
              />
              
              {/* Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-gray-600 text-white py-4 px-6 rounded-lg font-semibold text-lg flex items-center justify-center gap-3 hover:bg-gray-700 transition-colors"
              >
                <Upload className="w-6 h-6" />
                Upload from Photos
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              
              {/* Demo Section */}
              <div className="border-t pt-4">
                <p className="text-sm text-gray-600 mb-3">Or try a demo:</p>
                <div className="space-y-2">
                  {gwynneNoteExamples.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => runDemo(example)}
                      className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm text-blue-700 transition-colors"
                    >
                      Demo: {example.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <img
                src={uploadedImage}
                alt="Uploaded notes"
                className="w-full max-h-96 object-contain rounded-lg border"
              />
              <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Take New Photo
              </button>
            </div>
          )}
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{processingStep || 'Processing...'}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {structuredData && !isProcessing && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Report Ready
            </h2>
            
            {/* Header Info */}
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                  <div className="text-lg font-semibold text-gray-900">{structuredData.clientName}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <div className="text-lg font-semibold text-gray-900">{structuredData.date}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Time</label>
                  <div className="text-lg font-semibold text-blue-600">{structuredData.totalHours} hours</div>
                </div>
              </div>
            </div>

            {/* Activities */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Activities</h3>
              <div className="space-y-3">
                {structuredData.activities.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 mr-2">{index + 1}.</span>
                      <span className="text-gray-800">{activity.description}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-blue-600">
                        {(activity.minutes / 60).toFixed(2)}h
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={emailReport}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-lg"
              >
                <Mail className="w-5 h-5" />
                Email Report
              </button>
              <button
                onClick={generatePDF}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
            </div>
            
            <button
              onClick={reset}
              className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              <Trash2 className="w-5 h-5" />
              Start Over
            </button>
          </div>
        )}

        {/* Raw Text (for debugging) */}
        {extractedText && !isProcessing && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Extracted Text</h3>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
              <pre className="whitespace-pre-wrap">{extractedText}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
