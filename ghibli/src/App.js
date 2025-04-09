import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Available AI models with their display names and IDs
const AVAILABLE_MODELS = [
  { id: "deepseek-r1", name: "Deepseek R1", supportsImages: false },
  { id: "gpt-4o-image", name: "GPT-4o Image", supportsImages: true },
  { id: "claude-3.7-sonnet", name: "Claude 3.7 Sonnet", supportsImages: false },
  { id: "gemini-2.0-pro-exp-02-05", name: "Gemini 2.0 pro", supportsImages: true },
];

function App() {
  // State variables
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [remainingChats, setRemainingChats] = useState(0);
  const [streamingResponse, setStreamingResponse] = useState('');
  
  // New state for model selection
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [showModelSelect, setShowModelSelect] = useState(false);
  
  // Configuration
  const API_KEY = 'sk-5QEVbZuahSBnV3WUSTjhFTSQ8nvQT4pwGv3efyK86zoHbF7w';
  const API_URL = "https://aiclound.vip/v1/chat/completions";
  const CHATS_PER_AUTH = 100; // Number of chats per authorization code
  const MAX_HISTORY_MESSAGES = 10; // Maximum number of previous messages to include in context
  const MAX_TOKENS_PER_RESPONSE = 1000; // Maximum tokens for AI response
  
  // Valid authorization codes (in a real app, this would be stored on a server)
  const VALID_AUTH_CODES = {
    "GHIBLI2025": { maxUses: 100, used: 0 },
    "TOTORO2025": { maxUses: 100, used: 0 },
    "SPIRITED2025": { maxUses: 100, used: 0 }
  };
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Function to parse image responses
  const parseImageResponseForDisplay = (responseText) => {
    // Check if this is an image generation response with progress updates
    if (responseText.includes('🏃 进度:') || 
        responseText.includes('✅ 绘图已完成') ||
        responseText.includes('![image]')) {
      
      // Extract image URL from the response using regex
      const imageUrlRegex = /!\[image\]\((https:\/\/[^\)]+)\)/;
      const match = responseText.match(imageUrlRegex);
      
      if (match && match[1]) {
        // Return HTML for displaying just the image
        return `<div class="generated-image"><img src="${match[1]}" alt="AI Generated Image" style="max-width: 300px; height: auto;" /></div>`;
      }
    }
    
    // If not an image response or couldn't extract URL, return the original
    return responseText;
  };

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingResponse]);

  // Check if user is already authorized in local storage
  useEffect(() => {
    const checkAuth = () => {
      try {
        const storedAuth = localStorage.getItem('ghibliAiAuth');
        if (storedAuth) {
          const authData = JSON.parse(storedAuth);
          // Check if the stored data has expired or is valid
          if (authData.expiry > Date.now() && authData.remainingChats > 0) {
            setIsAuthorized(true);
            setRemainingChats(authData.remainingChats);
            setAuthCode(authData.code);
          } else {
            // Clear expired data
            localStorage.removeItem('ghibliAiAuth');
            setIsAuthorized(false);
            setRemainingChats(0);
          }
        } else {
          setIsAuthorized(false);
          setRemainingChats(0);
        }
      } catch (error) {
        console.error("Error retrieving authorization:", error);
        setIsAuthorized(false);
        setRemainingChats(0);
      }
    };
    
    checkAuth();
  }, []);

  // Authorize with code
  const authorizeWithCode = () => {
    try {
      setError('');
      
      if (!authCode.trim()) {
        setError('Please enter an authorization code.');
        return;
      }
      
      // Check if code is valid (in a real app, this would be a server request)
      const validCode = VALID_AUTH_CODES[authCode.trim().toUpperCase()];
      
      if (!validCode) {
        setError('Invalid authorization code. Please try again.');
        return;
      }
      
      if (validCode.used >= validCode.maxUses) {
        setError('This authorization code has reached its maximum usage limit.');
        return;
      }
      
      // Set authorized state
      setIsAuthorized(true);
      
      // Set remaining chats
      const remainingUses = validCode.maxUses - validCode.used;
      setRemainingChats(remainingUses);
      
      // Update code usage (in a real app, this would update on the server)
      VALID_AUTH_CODES[authCode.trim().toUpperCase()].used += 1;
      
      // Store in local storage with 30-day expiry
      const expiryTime = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days from now
      localStorage.setItem('ghibliAiAuth', JSON.stringify({
        code: authCode.trim().toUpperCase(),
        remainingChats: remainingUses,
        expiry: expiryTime
      }));
      
    } catch (error) {
      console.error("Error authorizing code:", error);
      setError(error.message || "Error authorizing code");
    }
  };

  // Handle file uploads
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    
    // Update the list of uploaded files
    setUploadedFiles(prevFiles => [...prevFiles, ...files]);
    
    // Reset the file input
    e.target.value = null;
  };

  // Send images to the API
  const prepareImageForUpload = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Convert the file to base64
        const base64Data = reader.result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('dragging');
  };

  // Handle drag leave
  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('dragging');
  };

  // Handle file drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragging');
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setUploadedFiles(prevFiles => [...prevFiles, ...files]);
    }
  };

  // Remove a file from the uploaded files list
  const removeFile = (index) => {
    setUploadedFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  // Toggle the file upload panel
  const toggleUploadPanel = () => {
    setShowUploadPanel(prev => !prev);
  };
  
  // Toggle the model selection panel
  const toggleModelSelect = () => {
    setShowModelSelect(prev => !prev);
  };
  
  // Handle model selection
  const handleModelSelect = (modelId) => {
    setSelectedModel(modelId);
    setShowModelSelect(false);
    
    // Check if the selected model supports images
    const model = AVAILABLE_MODELS.find(m => m.id === modelId);
    if (!model.supportsImages && uploadedFiles.length > 0) {
      setError(`The selected model (${model.name}) does not support image uploads. Images will be ignored.`);
    } else {
      setError('');
    }
  };

  // Call OpenAI API with streaming response
  const callOpenAIAPI = async (message, files = []) => {
    try {
      // Reset streaming response
      setStreamingResponse('');
      
      // Get the selected model info
      const modelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0];
      
      // Prepare the current message content
      let currentMessageContent = [];
      
      // Add text message if there's text
      if (message.trim()) {
        currentMessageContent.push({
          type: "text",
          text: message
        });
      }
      
      // Process images if any and if the selected model supports images
      if (modelInfo.supportsImages) {
        for (const file of files) {
          if (file.type.startsWith('image/')) {
            try {
              // Convert image to base64
              const base64Data = await prepareImageForUpload(file);
              
              // Add the image to the message content
              currentMessageContent.push({
                type: "image_url",
                image_url: {
                  url: `data:${file.type};base64,${base64Data}`
                }
              });
            } catch (imgError) {
              console.error('Error processing image:', imgError);
            }
          }
        }
      }
      
      // Prepare messages array with conversation history
      const conversationMessages = [];
      
      // Get the most recent messages (limit to MAX_HISTORY_MESSAGES to avoid excessive token usage)
      const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES);
      
      // Add previous messages from conversation history
      for (const historyMessage of recentMessages) {
        if (historyMessage.sender === 'user') {
          // Add user messages
          const userContent = [];
          
          // Add text if exists
          if (historyMessage.text && historyMessage.text.trim()) {
            userContent.push({
              type: "text",
              text: historyMessage.text
            });
          }
          
          // Add image files if they exist in history and the model supports images
          if (modelInfo.supportsImages && historyMessage.files) {
            // Only include up to 2 images from history to save tokens
            const imageFiles = historyMessage.files
              .filter(file => file.type && file.type.startsWith('image/') && file.base64Data)
              .slice(0, 2);
              
            for (const file of imageFiles) {
              userContent.push({
                type: "image_url",
                image_url: {
                  url: `data:${file.type};base64,${file.base64Data}`
                }
              });
            }
          }
          
          conversationMessages.push({
            role: "user",
            content: userContent
          });
        } else if (historyMessage.sender === 'ai') {
          // Add AI responses
          conversationMessages.push({
            role: "assistant",
            content: historyMessage.text
          });
        }
      }
      
      // Add the current message at the end
      conversationMessages.push({
        role: "user",
        content: currentMessageContent
      });
      
      // Prepare the request payload
      const payload = {
        model: selectedModel,
        messages: conversationMessages,
        stream: true,
        max_tokens: MAX_TOKENS_PER_RESPONSE
      };
      
      // Make the API request
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      // Create a reader to process the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullResponse = '';
      let isImageResponse = false;
      let accumulatedImageText = '';
      
      // Process the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Decode the chunk
        const chunk = decoder.decode(value);
        
        // Process streaming response
        const lines = chunk.split('\n');
        for (const line of lines) {
          // Skip empty lines
          if (!line.trim() || line.trim() === 'data: [DONE]') continue;
          
          try {
            // Parse the line (remove 'data: ' prefix if it exists)
            const jsonString = line.trim().startsWith('data: ') 
              ? line.trim().substring(6) 
              : line.trim();
            
            const json = JSON.parse(jsonString);
            
            // Extract content delta if available
            if (json.choices && 
                json.choices[0] && 
                json.choices[0].delta && 
                json.choices[0].delta.content) {
              const contentDelta = json.choices[0].delta.content;
              
              // Check if this might be part of an image response
              if (contentDelta.includes('🏃 进度:') || 
                  contentDelta.includes('✅ 绘图已完成') || 
                  contentDelta.includes('![image]')) {
                isImageResponse = true;
                
                accumulatedImageText += contentDelta;
                // Check if we have a complete image URL
                if (accumulatedImageText.includes('!\[(gen_[a-zA-Z0-9_]+)\]') && 
                    accumulatedImageText.match(/!\[(gen_[a-zA-Z0-9_]+)\]\((https:\/\/[^\)]+)\)/)) {
                  // We have a complete image URL, extract and display it
                  const imageHtml = parseImageResponseForDisplay(accumulatedImageText);
                  
                  // Update the streaming display with just the image
                  setStreamingResponse(imageHtml);
                  
                  // Add to full response (replacing accumulated image text)
                  fullResponse = fullResponse.replace(accumulatedImageText, '') + imageHtml;
                  
                  // Reset accumulated text since we've processed it
                  accumulatedImageText = '';
                } else {
                  // Still accumulating image response, don't display progress updates
                  // Just update fullResponse for now
                  fullResponse += contentDelta;
                }
              } else if (isImageResponse) {
                // This is part of an image response but not a progress indicator
                accumulatedImageText += contentDelta;
                fullResponse += contentDelta;
              } else {
                // Normal text response
                fullResponse += contentDelta;
                setStreamingResponse(prev => prev + contentDelta);
              }
            }
          } catch (err) {
            console.error('Error parsing stream chunk:', err, line);
          }
        }
      }
      
      // Process any remaining accumulated image text
      if (isImageResponse && accumulatedImageText) {
        const imageHtml = parseImageResponseForDisplay(accumulatedImageText);
        if (imageHtml !== accumulatedImageText) {
          // Replace the accumulated text with just the image HTML
          fullResponse = fullResponse.replace(accumulatedImageText, imageHtml);
          setStreamingResponse(imageHtml);
        }
      }
      
      // If the entire response was an image, make sure it's properly processed
      if (isImageResponse) {
        const imageHtml = parseImageResponseForDisplay(fullResponse);
        if (imageHtml !== fullResponse) {
          fullResponse = imageHtml;
        }
      }
      
      // Return the full response after stream is complete
      return fullResponse || 'No response from AI.';
      
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      return `API Error: ${error.message}`;
    }
  };

  // Send a message to the AI
  const sendMessage = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return;
    
    if (!isAuthorized) {
      setError('Please enter a valid authorization code first.');
      return;
    }
    
    // Check if user has remaining chats
    if (remainingChats <= 0) {
      setError('You have no chat credits remaining. Please use a new authorization code.');
      return;
    }
    
    // Check if selected model supports images
    const modelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel);
    if (!modelInfo.supportsImages && uploadedFiles.length > 0) {
      setError(`The selected model (${modelInfo.name}) does not support image uploads. Please remove images or select a different model.`);
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      // Create a new message content
      let messageContent = input.trim();
      
      // Process file attachments if any
      const fileAttachments = [];
      for (const file of uploadedFiles) {
        const fileInfo = {
          name: file.name,
          size: file.size,
          type: file.type
        };
        
        // If it's an image, also store the base64 data for history purposes
        if (file.type.startsWith('image/')) {
          try {
            const base64Data = await prepareImageForUpload(file);
            fileInfo.base64Data = base64Data;
          } catch (imgError) {
            console.error('Error processing image for storage:', imgError);
          }
        }
        
        fileAttachments.push(fileInfo);
      }
      
      // Add user message to chat
      const userMessage = { 
        sender: 'user', 
        text: messageContent, 
        files: fileAttachments
      };
      
      setMessages(prevMessages => [...prevMessages, userMessage]);
      setInput('');
      
      // Clear uploaded files after sending
      if (uploadedFiles.length > 0) {
        setUploadedFiles([]);
        setShowUploadPanel(false);
      }
      
      // Add a temporary placeholder for AI response
      const tempAiResponseId = Date.now();
      setMessages(prevMessages => [
        ...prevMessages, 
        { 
          id: tempAiResponseId,
          sender: 'ai', 
          text: '', 
          isStreaming: true
        }
      ]);
      
      // Call API to get AI response with the FULL conversation history
      const apiResponse = await callOpenAIAPI(messageContent, uploadedFiles);
      
      // Replace the placeholder with the complete response
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === tempAiResponseId 
            ? { sender: 'ai', text: apiResponse, isStreaming: false } 
            : msg
        )
      );
      
      // Reset streaming response
      setStreamingResponse('');
      
      // Decrement remaining chats
      const updatedRemainingChats = remainingChats - 1;
      setRemainingChats(updatedRemainingChats);
      
      // Update localStorage
      const storedData = localStorage.getItem('ghibliAiAuth');
      if (storedData) {
        const data = JSON.parse(storedData);
        data.remainingChats = updatedRemainingChats;
        localStorage.setItem('ghibliAiAuth', JSON.stringify(data));
      }
      
      setIsLoading(false);
      
    } catch (error) {
      console.error("Error sending message:", error);
      setError(error.message || "Error processing your request");
      setIsLoading(false);
      
      // Clean up any temporary message if there was an error
      setMessages(prevMessages => 
        prevMessages.filter(msg => !msg.isStreaming)
      );
      
      // Reset streaming response
      setStreamingResponse('');
    }
  };
  
  // Trigger the hidden file input
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  // Handle key press (Enter to send)
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Function to safely render HTML content (for images)
  const createMarkup = (htmlContent) => {
    return { __html: htmlContent };
  };

  // Render message bubbles
  const renderMessages = () => {
    return messages.map((message, index) => (
      <div 
        key={index} 
        className={`message ${message.sender === 'user' ? 'user-message' : 'ai-message'}`}
      >
        <div className="message-bubble">
          {/* For streaming AI messages, show the current streaming text */}
          {message.sender === 'ai' && message.isStreaming ? (
            <div 
              className="streaming-message" 
              dangerouslySetInnerHTML={createMarkup(streamingResponse)}
            ></div>
          ) : (
            // Check if the message contains HTML content (for images)
            message.text && message.text.includes('<div class="generated-image">') ? (
              <div dangerouslySetInnerHTML={createMarkup(message.text)}></div>
            ) : (
              message.text
            )
          )}
          
          {/* Render file attachments if any */}
          {message.files && message.files.length > 0 && (
            <div className="file-attachments">
              {message.files.map((file, fileIndex) => (
                <div key={fileIndex} className="file-attachment">
                  <div className="file-icon">
                    {getFileIcon(file.type)}
                  </div>
                  <div className="file-info">
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">{formatFileSize(file.size)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    ));
  };

  // Get appropriate icon for file type
  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) {
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
          <path d="M21 15L16 10L9 17" stroke="currentColor" strokeWidth="2" />
          <path d="M7 17L9 15L11 17" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    } else if (fileType.startsWith('text/')) {
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 3H7C5.89543 3 5 3.89543 5 5V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V8L14 3Z" stroke="currentColor" strokeWidth="2" />
          <path d="M9 13H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 17H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M14 3V8H19" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    } else if (fileType.startsWith('application/pdf')) {
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 3H7C5.89543 3 5 3.89543 5 5V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V8L14 3Z" stroke="currentColor" strokeWidth="2" />
          <path d="M14 3V8H19" stroke="currentColor" strokeWidth="2" />
          <path d="M9 13H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 10H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 16H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    } else {
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 3H7C5.89543 3 5 3.89543 5 5V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V8L14 3Z" stroke="currentColor" strokeWidth="2" />
          <path d="M14 3V8H19" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    }
  };

  // Format file size (converts bytes to KB, MB, etc.)
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="app">
      <div className="header">
        <h1>Studio Ghibli AI Chat</h1>
        <div className="ghibli-auth-section">
  {!isAuthorized ? (
    <div className="ghibli-auth-form">
      <div className="soot-sprite-decoration left"></div>
      <div className="auth-input-container">
        <input
          type="text"
          value={authCode}
          onChange={(e) => setAuthCode(e.target.value)}
          placeholder="enter code..."
          onKeyPress={(e) => e.key === 'Enter' && authorizeWithCode()}
          className="ghibli-input"
        />
        <button className="ghibli-button" onClick={authorizeWithCode}>
          activite
        </button>
      </div>
      <div className="soot-sprite-decoration right"></div>
    </div>
  ) : (
    <div className="ghibli-auth-info">
      <div className="totoro-badge">
        <div className="mini-totoro"></div>
        <span>code: {authCode}</span>
      </div>
      <div className={`ghibli-credits ${remainingChats === 0 ? 'no-credits' : ''}`}>
        <div className="leaf-icon"></div>
        <span>chat times: {remainingChats} / {CHATS_PER_AUTH}</span>
      </div>
    </div>
  )}
</div>
 
      </div>
      
      {/* Model Selection Button */}
      <div className="model-selector">
        <div className="selected-model" onClick={toggleModelSelect}>
          <div className="model-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" stroke="currentColor" strokeWidth="2" />
              <path d="M3 12H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M17 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 7V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 21V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span>Model: {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || 'Unknown'}</span>
          <div className="dropdown-arrow">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        
        {/* Model Selection Dropdown */}
        {showModelSelect && (
          <div className="model-dropdown">
            {AVAILABLE_MODELS.map(model => (
              <div 
                key={model.id} 
                className={`model-option ${selectedModel === model.id ? 'selected' : ''}`}
                onClick={() => handleModelSelect(model.id)}
              >
                <div className="model-name">{model.name}</div>
                {model.supportsImages && (
                  <div className="model-badge">Images</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="chat-container">
        <div className="messages">
          {messages.length === 0 ? (
            <div className="welcome-message">
              <div className="totoro">
                <div className="totoro-body"></div>
                <div className="totoro-ears left"></div>
                <div className="totoro-ears right"></div>
                <div className="totoro-eyes left"></div>
                <div className="totoro-eyes right"></div>
                <div className="totoro-nose"></div>
                <div className="totoro-whiskers w1"></div>
                <div className="totoro-whiskers w2"></div>
                <div className="totoro-whiskers w3"></div>
                <div className="totoro-whiskers w4"></div>
                <div className="totoro-belly"></div>
              </div>
              <p>Welcome to the Ghibli AI Chat! Enter your authorization code to start chatting.</p>
              <p>Choose from multiple AI models including those that support image uploads.</p>
              <p className="fee-note">Each authorization code gives you {CHATS_PER_AUTH} chat messages!</p>
              {isAuthorized && remainingChats === 0 && (
                <div className="purchase-prompt">
                  <p>You have no chat credits remaining.</p>
                  <p>Please use a new authorization code to continue chatting.</p>
                </div>
              )}
            </div>
          ) : (
            renderMessages()
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* File upload panel */}
        {showUploadPanel && (
          <div className="upload-panel">
            <div className="upload-header">
              <h3>File Attachments</h3>
              <button className="close-panel" onClick={toggleUploadPanel}>×</button>
            </div>
            
            <div 
              className="upload-area" 
              onClick={triggerFileInput}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                style={{ display: 'none' }}
              />
              <div className="upload-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V3M12 3L7 8M12 3L17 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20 16.8V19.2C20 20.8802 20 21.7202 19.673 22.362C19.3854 22.9265 18.9265 23.3854 18.362 23.673C17.7202 24 16.8802 24 15.2 24H8.8C7.11984 24 6.27976 24 5.63803 23.673C5.07354 23.3854 4.6146 22.9265 4.32698 22.362C4 21.7202 4 20.8802 4 19.2V16.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p>Click to select files or drag and drop</p>
            </div>
            
            {uploadedFiles.length > 0 && (
              <div className="file-list">
                <h4>Selected Files</h4>
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="file-item">
                    <div className="file-item-icon">
                      {getFileIcon(file.type)}
                    </div>
                    <div className="file-item-info">
                      <div className="file-item-name">{file.name}</div>
                      <div className="file-item-size">{formatFileSize(file.size)}</div>
                    </div>
                    <button 
                      className="remove-file"
                      onClick={() => removeFile(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        <div className="input-container">
          <div className="input-wrapper">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message here..."
              disabled={!isAuthorized || isLoading || remainingChats <= 0}
            />
            
            <button 
              className={`upload-button ${showUploadPanel ? 'active' : ''} ${uploadedFiles.length > 0 ? 'has-files' : ''}`}
              onClick={toggleUploadPanel}
              disabled={!isAuthorized || isLoading || remainingChats <= 0 || (!AVAILABLE_MODELS.find(m => m.id === selectedModel)?.supportsImages)}
              title={AVAILABLE_MODELS.find(m => m.id === selectedModel)?.supportsImages ? "Attach files" : "Selected model doesn't support images"}
            >
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21.44 11.05L12.25 20.24C11.1242 21.3658 9.59699 21.9983 8.005 21.9983C6.41301 21.9983 4.88577 21.3658 3.76 20.24C2.63423 19.1142 2.00171 17.587 2.00171 15.995C2.00171 14.403 2.63423 12.8758 3.76 11.75L12.33 3.18C13.0806 2.42976 14.0991 2.00013 15.165 2.00013C16.2309 2.00013 17.2494 2.42976 18 3.18C18.7502 3.93063 19.1799 4.94908 19.1799 5.995C19.1799 7.04092 18.7502 8.05937 18 8.81L9.41 17.41C9.03472 17.7853 8.52573 18 7.995 18C7.46427 18 6.95528 17.7853 6.58 17.41C6.20528 17.0347 5.99064 16.5257 5.99064 15.995C5.99064 15.4643 6.20528 14.9553 6.58 14.58L14.25 6.9" 
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {uploadedFiles.length > 0 && (
                <span className="file-count">{uploadedFiles.length}</span>
              )}
            </button>
          </div>
          
          <button 
            className={`send-button ${isLoading ? 'loading' : ''}`}
            onClick={sendMessage}
            disabled={!isAuthorized || (!input.trim() && uploadedFiles.length === 0) || isLoading || remainingChats <= 0}
          >
            {isLoading ? (
              <div className="soot-sprite-loading">
                <div className="soot-sprite"></div>
                <div className="soot-sprite"></div>
                <div className="soot-sprite"></div>
              </div>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="footer">
        <p>Inspired by Studio Ghibli • Multiple AI Models • Use authorization codes for access</p>
        <div className="soot-sprites-container">
          <div className="soot-sprite-animated"></div>
          <div className="soot-sprite-animated"></div>
          <div className="soot-sprite-animated"></div>
        </div>
      </div>
    </div>
  );
}

export default App;