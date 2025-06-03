import React, { useState, useEffect } from 'react';

function App() {
  const [logData, setLogData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [papaLoaded, setPapaLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState(''); // State for error messages

  // useEffect hook to dynamically load the PapaParse library from a CDN
  useEffect(() => {
    // Check if PapaParse is already available globally
    if (window.Papa) {
      setPapaLoaded(true);
      return;
    }

    // Create a new script element for PapaParse
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js'; // CDN URL
    script.async = true; // Load script asynchronously

    // Set onload event to update state once the script is successfully loaded
    script.onload = () => {
      setPapaLoaded(true);
      console.log('PapaParse loaded successfully!');
    };

    // Set onerror event for debugging if the script fails to load
    script.onerror = () => {
      console.error('Failed to load PapaParse script. Check network connection or CDN link.');
      setErrorMessage('Failed to load PapaParse. Please check your internet connection.');
    };

    // Append the script to the document body to start loading
    document.body.appendChild(script);

    // Cleanup function: remove the script when the component unmounts
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []); 
  
  // Handles the file upload and parses the CSV data
  const handleFileUpload = (event) => {
    setLogData([]); 
    setErrorMessage(''); 
    const file = event.target.files[0];

    // Only proceed if a file is selected and PapaParse has been loaded
    if (file && papaLoaded) {
      setFileName(file.name); // Set the name of the uploaded file
      window.Papa.parse(file, {
        header: true, // Crucially, set to true to parse with headers
        skipEmptyLines: true, // Skip any empty lines in the CSV
        complete: (result) => {
          // Check for parsing errors
          if (result.errors.length) {
            console.error('PapaParse errors:', result.errors);
            setErrorMessage('Error parsing file: ' + result.errors[0].message);
            return;
          }
          // Process the parsed data, passing data and fields (headers)
          processLogData(result.data, result.meta.fields);
        },
        error: (err) => {
          console.error('PapaParse error:', err);
          setErrorMessage('Failed to parse CSV file. Please ensure it is a valid CSV.');
        }
      });
    } else if (file && !papaLoaded) {
      // Warn user if PapaParse is still loading
      setErrorMessage('PapaParse library is still loading. Please try uploading the file again in a moment.');
    } else if (!file) {
      // Clear file name if no file is selected (e.g., user cancels file dialog)
      setFileName('');
    }
  };

  // Processes the log data to identify failure blocks based on headers
  const processLogData = (data, headers) => {
    const processedFailureBlocks = [];
    let currentBlockStartTime = null;
    let currentBlockEndTime = null;
    let currentDate= null;

    // Find the indices of the 'date', 'time', and 'status' columns (case-insensitive and trimmed)
    const dateIndex = headers.findIndex(header => header.toLowerCase().trim() === 'date');
    const timeIndex = headers.findIndex(header => header.toLowerCase().trim() === 'time');
    const statusIndex = headers.findIndex(header => header.toLowerCase().trim() === 'status');

    // Validate if essential headers are present
    if (dateIndex === -1 || timeIndex === -1 || statusIndex === -1) {
      setErrorMessage('CSV must contain "Date", "Time", and "Status" columns in its header.');
      setLogData([]); // Clear any partially processed data
      return;
    }

    data.forEach((row) => {
      // Access data by header name (case-insensitive for robustness)
      const date = row[headers[dateIndex]] ? String(row[headers[dateIndex]]).trim() : '-';
      const time = row[headers[timeIndex]] ? String(row[headers[timeIndex]]).trim() : '-';
      const status = row[headers[statusIndex]] ? String(row[headers[statusIndex]]).trim().toLowerCase() : '';

      console.log('date',date );

      if (status === 'failure') {
        if (currentBlockStartTime === null) {
          currentBlockStartTime = time;
          currentDate= date;
        }
        currentBlockEndTime = time;
      } else {
        if (currentBlockStartTime !== null) {
          // Push the identified failure block
          processedFailureBlocks.push({
            status: 'Failure Block',
            date: currentDate,
            startTime: currentBlockStartTime,
            endTime: currentBlockEndTime,
          });
          // Reset for the next block
          currentBlockStartTime = null;
          currentBlockEndTime = null;
          currentDate=null;
        }
      }
    });

    // After the loop, check if there's an unclosed failure block (i.e., file ends with failure)
    if (currentBlockStartTime !== null) {
      processedFailureBlocks.push({
        status: 'Failure Block (No trailing OK)', // Indicate if the block didn't end with an 'OK'
        date: currentDate,
        startTime: currentBlockStartTime,
        endTime: currentBlockEndTime,
      });
    }

    // Update the state with the processed failure blocks
    setLogData(processedFailureBlocks);
    // Set error message if no failure blocks are found after a file is selected
    if (processedFailureBlocks.length === 0 && fileName) {
      setErrorMessage('No failure blocks found in the uploaded file.');
    } else {
      setErrorMessage(''); // Clear error if data is processed successfully
    }
    console.log('Processed Failure Blocks:', processedFailureBlocks);
  };

  // Handles the download of the processed log data as a CSV file
  const handleDownloadCsv = () => {
    if (logData.length === 0) {
      // If no data, do nothing
      return;
    }

    // Prepare data for CSV, ensuring headers are included
    const csvData = [
      ['Status', 'date', 'Start Time', 'End Time'], // CSV header row
      ...logData.map(block => [block.status, block.date, block.startTime, block.endTime]) // Map logData to CSV rows
    ];

    // Convert the array of arrays to a CSV string using PapaParse
    const csv = window.Papa.unparse(csvData);

    // Create a Blob from the CSV string with the correct MIME type
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    // Create a temporary URL for the Blob
    const url = URL.createObjectURL(blob);

    // Create a temporary anchor element to trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'logging_file.csv'); // Set the download filename
    document.body.appendChild(link); // Append to body to make it clickable

    link.click(); // Programmatically click the link to start download

    document.body.removeChild(link); // Clean up the temporary link
    URL.revokeObjectURL(url); // Revoke the object URL to free up memory
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 font-sans">
      <h1 className="text-4xl font-extrabold text-gray-800 mb-8 tracking-tight">Log File Analyzer</h1>
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl border border-gray-200">
        <div className="mb-6">
          <label htmlFor="file-upload" className="block text-gray-700 text-base font-semibold mb-2">
            Upload CSV File:
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-600
                         file:mr-4 file:py-2 file:px-4
                         file:rounded-full file:border-0
                         file:text-sm file:font-semibold
                         file:bg-blue-100 file:text-blue-700
                         hover:file:bg-blue-200 cursor-pointer transition duration-200 ease-in-out"
          />
          {fileName && <p className="mt-3 text-sm text-gray-500">Selected file: <span className="font-medium text-gray-700">{fileName}</span></p>}
          {/* Updated instruction for required columns */}
          <p className="mt-2 text-xs text-gray-500">Please ensure your CSV includes "Date", "Time", and "Status" columns.</p>
        </div>

        {/* Display error messages */}
        {errorMessage && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md" role="alert">
            {errorMessage}
          </div>
        )}

        {logData.length > 0 && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Processed Log Entries:</h2>
              <button
                onClick={handleDownloadCsv}
                className="px-5 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md
                           hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75
                           transition duration-200 ease-in-out"
              >
                Download CSV
              </button>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 h-96 overflow-y-auto shadow-inner">
              <div className='flex justify-between items-center bg-gray-100 p-2 rounded-md mb-3 font-semibold text-gray-700 border-b border-gray-200'>
                <span className='w-1/3 text-center'>Status</span>
                <span className='w-1/3 text-center'>Date</span>
                <span className='w-1/3 text-center'>Start Time</span> {/* This will now include date */}
                <span className='w-1/3 text-center'>End Time</span>   {/* This will now include date */}
              </div>
              {logData.map((block, index) => (
                <div key={index} className="mb-3 p-3 border border-red-200 rounded-lg bg-red-50 flex justify-between items-center text-sm">
                  <p className="font-medium text-red-700 w-1/3 text-center">{block.status}</p>
                  <p className="font-medium text-red-700 w-1/3 text-center">{block.date}</p>
                  <p className="text-red-600 w-1/3 text-center font-mono">{block.startTime}</p>
                  <p className="text-red-600 w-1/3 text-center font-mono">{block.endTime}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Display message when no failure blocks are found after a file is selected and no other error */}
        {logData.length === 0 && fileName && !errorMessage && (
          <p className="mt-8 text-center text-lg text-gray-600 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            No failure blocks found in the uploaded file.
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
