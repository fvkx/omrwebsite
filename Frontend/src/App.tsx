import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, 
  UploadCloud, 
  History, 
  Plus, 
  BookOpen, 
  GraduationCap, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Eye, 
  Info,
  Sparkles,
  FileUp
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Exam, Submission, QuickScanResult, GradeResult } from './types';
import { fetchExams, createExam, gradeSheet, extractSheet, fetchSubmissions } from './api';

// Toast Notification Type
interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'quick-scan' | 'exams' | 'history'>('dashboard');

  // Core Data State
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Quick Scanner State
  const [quickScanLoading, setQuickScanLoading] = useState(false);
  const [quickScanResult, setQuickScanResult] = useState<QuickScanResult | null>(null);

  // Exam Creation State
  const [showCreateExam, setShowCreateExam] = useState(false);
  const [newExamName, setNewExamName] = useState('');
  const [newExamKey, setNewExamKey] = useState<Record<string, string>>({});
  const [keyUploadLoading, setKeyUploadLoading] = useState(false);

  // Active Exam Inspection & Grading State
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [gradingProgress, setGradingProgress] = useState<{current: number; total: number} | null>(null);
  const [latestGradeResult, setLatestGradeResult] = useState<GradeResult | null>(null);

  // Submissions Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  // Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Refs for file uploads
  const quickScanInputRef = useRef<HTMLInputElement>(null);
  const keyScanInputRef = useRef<HTMLInputElement>(null);
  const studentScanInputRef = useRef<HTMLInputElement>(null);

  // Add a Toast Notification
  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Initial Data Fetch
  useEffect(() => {
    loadExams();
    loadSubmissions();
  }, []);

  const loadExams = async () => {
    setLoadingExams(true);
    try {
      const data = await fetchExams();
      setExams(data);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load exams');
    } finally {
      setLoadingExams(false);
    }
  };

  const loadSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const data = await fetchSubmissions();
      setSubmissions(data);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load submissions');
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // Trigger Confetti Effect
  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 }
    });
  };

  // Handle Quick Scan Upload
  const handleQuickScanUpload = async (file: File) => {
    if (!file) return;
    setQuickScanLoading(true);
    setQuickScanResult(null);

    try {
      const res = await extractSheet(file);
      setQuickScanResult(res);
      addToast('success', 'OMR sheet processed successfully!');
      triggerConfetti();
    } catch (err: any) {
      addToast('error', err.message || 'OMR processing failed.');
    } finally {
      setQuickScanLoading(false);
    }
  };

  // Handle Answer Key Image Upload (To auto-extract key during exam creation)
  const handleKeySheetUpload = async (file: File) => {
    if (!file) return;
    setKeyUploadLoading(true);
    try {
      const res = await extractSheet(file);
      // Populate newExamKey with the extracted non-null answers
      const extractedKey: Record<string, string> = {};
      Object.entries(res.answers).forEach(([q, val]) => {
        if (val) extractedKey[q] = val;
      });
      setNewExamKey(extractedKey);
      addToast('success', 'Answer key extracted from sheet image successfully!');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to extract answer key from image.');
    } finally {
      setKeyUploadLoading(false);
    }
  };

  // Handle Exam Submission Creation
  const handleCreateExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamName.trim()) {
      addToast('error', 'Exam name is required.');
      return;
    }
    if (Object.keys(newExamKey).length === 0) {
      addToast('error', 'Please configure at least one answer in the key.');
      return;
    }

    try {
      await createExam(newExamName, newExamKey);
      addToast('success', `Exam "${newExamName}" created successfully.`);
      setNewExamName('');
      setNewExamKey({});
      setShowCreateExam(false);
      loadExams();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to create exam.');
    }
  };

  // Handle Grading Student Sheets
  const handleGradeSheetsSubmit = async (files: File[]) => {
    if (files.length === 0 || !selectedExamId) return;
    setGradingProgress({ current: 0, total: files.length });
    setLatestGradeResult(null);

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < files.length; i++) {
      setGradingProgress({ current: i + 1, total: files.length });
      try {
        const res = await gradeSheet(selectedExamId, files[i]);
        setLatestGradeResult(res);
        successCount++;
      } catch (err: any) {
        failedCount++;
        addToast('error', `Failed to grade ${files[i].name}: ${err.message}`);
      }
    }

    setGradingProgress(null);
    loadSubmissions();

    if (successCount > 0) {
      addToast('success', `Successfully graded ${successCount} sheet(s).`);
      triggerConfetti();
    }
  };

  // Fetch submission overlay image when viewing submission details
  const viewSubmissionDetails = (sub: Submission) => {
    setSelectedSubmission(sub);
    
    // In our backend database, we save submissions but do not store overlay images directly.
    // Instead of re-grading to get overlay base64, we can retrieve it or show detailed breakdown.
    // Wait, the API returns `overlay_image` only on active grading `/api/grade`.
    // So for historical details, we show the question list with colors (correct/incorrect)
    // which is already super useful.
  };

  // Helper: Format ISO date to readable string
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate quick dashboard stats
  const totalSheetsGraded = submissions.length;
  const averagePercentage = totalSheetsGraded > 0 
    ? Math.round((submissions.reduce((acc, sub) => acc + (sub.score / (sub.total_questions || 50)), 0) / totalSheetsGraded) * 100)
    : 0;
  const totalExamsCount = exams.length;

  const activeExam = exams.find(e => e.id === selectedExamId);

  return (
    <div className="app-container">
      {/* Toast Notification Feed */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.type === 'success' && <CheckCircle2 className="text-success" size={18} />}
            {toast.type === 'error' && <XCircle className="text-danger" size={18} />}
            {toast.type === 'info' && <Info className="text-info" size={18} />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          🎯 Aero<span>OMR</span>
        </div>
        <ul className="sidebar-menu">
          <li 
            className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <BarChart3 size={18} />
            Dashboard
          </li>
          <li 
            className={`sidebar-item ${activeTab === 'quick-scan' ? 'active' : ''}`}
            onClick={() => setActiveTab('quick-scan')}
          >
            <Sparkles size={18} />
            Quick Scanner
          </li>
          <li 
            className={`sidebar-item ${activeTab === 'exams' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('exams');
              if (exams.length > 0 && !selectedExamId) {
                setSelectedExamId(exams[0].id);
              }
            }}
          >
            <BookOpen size={18} />
            Exams & Grading
          </li>
          <li 
            className={`sidebar-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={18} />
            Grading History
          </li>
        </ul>
        <div className="sidebar-footer">
          AeroOMR Engine v2.0<br />
          React-TS Client
        </div>
      </aside>

      {/* Main View Area */}
      <main className="main-content">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="header-container">
              <div>
                <h1 className="header-title">OMR Grading Dashboard</h1>
                <p className="header-subtitle">Welcome back. View statistics and perform actions below.</p>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="stats-grid">
              <div className="card stat-card">
                <div className="stat-icon">
                  <BookOpen size={24} />
                </div>
                <div className="stat-info">
                  <h3>Total Exams</h3>
                  <p>{totalExamsCount}</p>
                </div>
              </div>
              <div className="card stat-card">
                <div className="stat-icon">
                  <GraduationCap size={24} />
                </div>
                <div className="stat-info">
                  <h3>Sheets Graded</h3>
                  <p>{totalSheetsGraded}</p>
                </div>
              </div>
              <div className="card stat-card">
                <div className="stat-icon">
                  <Sparkles size={24} />
                </div>
                <div className="stat-info">
                  <h3>Average Accuracy</h3>
                  <p>{averagePercentage}%</p>
                </div>
              </div>
            </div>

            {/* Dashboard Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
              {/* Recent Submissions */}
              <div className="card">
                <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <History size={18} className="text-secondary" /> Recent Graded Submissions
                </h2>
                {loadingSubmissions ? (
                  <div className="spinner-container">
                    <div className="spinner"></div>
                  </div>
                ) : submissions.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No graded sheets recorded yet. Head over to <strong>Exams & Grading</strong> to grade your first student sheet!
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Student ID</th>
                          <th>Exam</th>
                          <th>Score</th>
                          <th>Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.slice(0, 5).map(sub => {
                          const exam = exams.find(e => e.id === sub.exam_id);
                          const pct = Math.round((sub.score / (sub.total_questions || 50)) * 100);
                          return (
                            <tr key={sub.id}>
                              <td style={{ fontWeight: 600 }}>{sub.student_id || 'N/A'}</td>
                              <td>{exam ? exam.name : 'Unknown Exam'}</td>
                              <td>{sub.score} / {sub.total_questions}</td>
                              <td>
                                <span className={`badge ${pct >= 70 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-error'}`}>
                                  {pct}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.2rem' }}>Quick Actions</h2>
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => setActiveTab('quick-scan')}
                >
                  <Sparkles size={18} /> Quick Bubble Reader
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => {
                    setActiveTab('exams');
                    setShowCreateExam(true);
                  }}
                >
                  <Plus size={18} /> Configure New Exam
                </button>
                <div style={{ marginTop: 'auto', background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.5rem' }}>
                    <Info size={14} /> How it works
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    The OMR Engine scans your uploaded sheet, performs corner detection, warps the grid, and measures the brightness/fill-ratio of the bubbles using OpenCV.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QUICK SCANNER TAB */}
        {activeTab === 'quick-scan' && (
          <div>
            <div className="header-container">
              <div>
                <h1 className="header-title">Quick Bubble Reader</h1>
                <p className="header-subtitle">Upload any completed ZipGrade sheet to read raw student marks instantly.</p>
              </div>
            </div>

            <div className="card" style={{ marginBottom: '2rem' }}>
              <input 
                type="file" 
                ref={quickScanInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={(e) => e.target.files && handleQuickScanUpload(e.target.files[0])}
              />
              <div 
                className="dropzone"
                onClick={() => quickScanInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleQuickScanUpload(e.dataTransfer.files[0]);
                  }
                }}
              >
                <UploadCloud size={48} className="dropzone-icon" />
                <h3>Drag & drop a ZipGrade sheet image here</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  or click to browse from local computer files (Supports JPG, PNG up to 10MB)
                </p>
              </div>
            </div>

            {quickScanLoading && (
              <div className="card spinner-container">
                <div className="spinner"></div>
                <p style={{ fontWeight: 600, color: 'var(--primary)' }}>OMR engine calibrating markers and extracting marks...</p>
              </div>
            )}

            {quickScanResult && (
              <div className="grade-layout">
                {/* Visual Image Overlay */}
                <div className="card">
                  <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyItems: 'center', gap: '0.5rem' }}>
                    Annotated Scan Image
                  </h3>
                  <div className="image-preview-container">
                    <img 
                      src={`data:image/png;base64,${quickScanResult.overlay_image}`} 
                      alt="OMR Scan Overlay" 
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', fontSize: '0.75rem', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ width: '10px', height: '10px', backgroundColor: '#10b981', borderRadius: '50%' }}></span> Green: Detected Mark
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ width: '10px', height: '10px', backgroundColor: '#f59e0b', borderRadius: '50%' }}></span> Yellow: Ambiguity (Multi-filled)
                    </div>
                  </div>
                </div>

                {/* Read Answers list */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3>Parsed Sheet Data</h3>
                    <div className="badge badge-success" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                      StudentID: {quickScanResult.student_id || 'Empty'}
                    </div>
                  </div>

                  <div className="results-scrollable bubble-sheet-card">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      {/* Left Column (Q1-25) */}
                      <div>
                        {Array.from({ length: 25 }, (_, i) => i + 1).map(qNum => {
                          const qStr = qNum.toString();
                          const detectedVal = quickScanResult.answers[qStr];
                          return (
                            <div key={qStr} className="bubble-row" style={{ padding: '0.35rem 0.5rem' }}>
                              <span className="bubble-num">{qNum}.</span>
                              <div className="bubble-options">
                                {['A', 'B', 'C', 'D', 'E'].map(opt => (
                                  <span 
                                    key={opt} 
                                    className={`bubble-btn ${detectedVal === opt ? 'active' : ''}`}
                                    style={{ width: '26px', height: '26px', fontSize: '0.75rem', pointerEvents: 'none' }}
                                  >
                                    {opt}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Right Column (Q26-50) */}
                      <div>
                        {Array.from({ length: 25 }, (_, i) => i + 26).map(qNum => {
                          const qStr = qNum.toString();
                          const detectedVal = quickScanResult.answers[qStr];
                          return (
                            <div key={qStr} className="bubble-row" style={{ padding: '0.35rem 0.5rem' }}>
                              <span className="bubble-num">{qNum}.</span>
                              <div className="bubble-options">
                                {['A', 'B', 'C', 'D', 'E'].map(opt => (
                                  <span 
                                    key={opt} 
                                    className={`bubble-btn ${detectedVal === opt ? 'active' : ''}`}
                                    style={{ width: '26px', height: '26px', fontSize: '0.75rem', pointerEvents: 'none' }}
                                  >
                                    {opt}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* EXAMS & GRADING TAB */}
        {activeTab === 'exams' && (
          <div>
            <div className="header-container">
              <div>
                <h1 className="header-title">Exams & Grading</h1>
                <p className="header-subtitle">Manage exam answer keys and grade student sheets.</p>
              </div>
              <button 
                className="btn btn-primary"
                onClick={() => setShowCreateExam(true)}
              >
                <Plus size={18} /> Create Exam
              </button>
            </div>

            {/* Create Exam Form Modal/Section */}
            {showCreateExam && (
              <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--primary)' }}>
                <h3 style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Configure New Exam
                  <button className="btn btn-danger" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => setShowCreateExam(false)}>
                    Cancel
                  </button>
                </h3>
                
                <form onSubmit={handleCreateExamSubmit}>
                  <div className="form-group">
                    <label className="form-label">Exam Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Midterm Physics, Quiz 1" 
                      value={newExamName}
                      onChange={(e) => setNewExamName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="exam-layout">
                    {/* Setup Key options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Configure Official Answer Key</h4>
                      
                      <input 
                        type="file" 
                        ref={keyScanInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={(e) => e.target.files && handleKeySheetUpload(e.target.files[0])}
                      />
                      
                      <button 
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => keyScanInputRef.current?.click()}
                        disabled={keyUploadLoading}
                        style={{ width: '100%' }}
                      >
                        {keyUploadLoading ? 'Extracting...' : 'Scan Answer Key Sheet'}
                      </button>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        💡 Tip: You can scan a pre-filled OMR sheet containing the correct answers to auto-fill this form!
                      </p>
                    </div>

                    {/* Manual interactive key bubbles */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Bubble Sheet Answer Key (Click to set)</h4>
                      <div className="bubble-sheet-card" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', maxHeight: '400px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          {/* Q1-25 */}
                          <div>
                            {Array.from({ length: 25 }, (_, i) => i + 1).map(qNum => {
                              const qStr = qNum.toString();
                              return (
                                <div key={qStr} className="bubble-row" style={{ padding: '0.25rem 0.5rem' }}>
                                  <span className="bubble-num">{qNum}.</span>
                                  <div className="bubble-options">
                                    {['A', 'B', 'C', 'D', 'E'].map(opt => (
                                      <button 
                                        key={opt} 
                                        type="button"
                                        className={`bubble-btn ${newExamKey[qStr] === opt ? 'active' : ''}`}
                                        style={{ width: '24px', height: '24px', fontSize: '0.75rem' }}
                                        onClick={() => setNewExamKey(prev => ({
                                          ...prev,
                                          [qStr]: prev[qStr] === opt ? '' : opt
                                        }))}
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Q26-50 */}
                          <div>
                            {Array.from({ length: 25 }, (_, i) => i + 26).map(qNum => {
                              const qStr = qNum.toString();
                              return (
                                <div key={qStr} className="bubble-row" style={{ padding: '0.25rem 0.5rem' }}>
                                  <span className="bubble-num">{qNum}.</span>
                                  <div className="bubble-options">
                                    {['A', 'B', 'C', 'D', 'E'].map(opt => (
                                      <button 
                                        key={opt} 
                                        type="button"
                                        className={`bubble-btn ${newExamKey[qStr] === opt ? 'active' : ''}`}
                                        style={{ width: '24px', height: '24px', fontSize: '0.75rem' }}
                                        onClick={() => setNewExamKey(prev => ({
                                          ...prev,
                                          [qStr]: prev[qStr] === opt ? '' : opt
                                        }))}
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                    <button type="submit" className="btn btn-primary">
                      Save Exam & Answer Key
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Main view with select and lists */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
              {/* Left Column: Exams Selector list */}
              <div className="card">
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Exams List</h3>
                {loadingExams ? (
                  <div className="spinner-container">
                    <div className="spinner"></div>
                  </div>
                ) : exams.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No exams found. Click "Create Exam" to configure one.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {exams.map(exam => (
                      <div 
                        key={exam.id} 
                        className={`sidebar-item ${selectedExamId === exam.id ? 'active' : ''}`}
                        style={{ padding: '1rem', cursor: 'pointer', display: 'block' }}
                        onClick={() => {
                          setSelectedExamId(exam.id);
                          setLatestGradeResult(null);
                        }}
                      >
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{exam.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          Key set for {Object.keys(exam.answer_key).length} questions
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Active Exam Grading Controls & Key details */}
              <div className="card">
                {activeExam ? (
                  <div>
                    <h2 style={{ marginBottom: '0.5rem' }}>{activeExam.name}</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                      Created at {formatDate(activeExam.created_at)}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                      {/* Grading dropzone */}
                      <div style={{ borderRight: '1px solid var(--border)', paddingRight: '1.5rem' }}>
                        <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Grade Student OMR Sheets</h4>
                        
                        <input 
                          type="file" 
                          ref={studentScanInputRef}
                          style={{ display: 'none' }}
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            if (e.target.files) {
                              const filesArr = Array.from(e.target.files);
                              handleGradeSheetsSubmit(filesArr);
                            }
                          }}
                        />

                        <div 
                          className="dropzone"
                          style={{ padding: '2rem 1rem' }}
                          onClick={() => studentScanInputRef.current?.click()}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer.files) {
                              const filesArr = Array.from(e.dataTransfer.files);
                              handleGradeSheetsSubmit(filesArr);
                            }
                          }}
                        >
                          <FileUp size={36} className="text-secondary" style={{ marginBottom: '0.5rem' }} />
                          <h4 style={{ fontSize: '0.85rem' }}>Upload Student OMR Sheets</h4>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            (Select one or multiple images at once)
                          </p>
                        </div>

                        {gradingProgress && (
                          <div style={{ marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                              <span>Grading student sheets...</span>
                              <span>{gradingProgress.current} / {gradingProgress.total}</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: 'var(--bg-base)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div 
                                style={{ 
                                  height: '100%', 
                                  background: 'var(--primary)', 
                                  width: `${(gradingProgress.current / gradingProgress.total) * 100}%`,
                                  transition: 'width 0.2s'
                                }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Display Key configured */}
                      <div>
                        <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Configured Answer Key</h4>
                        <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem' }}>
                          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                            <tbody>
                              {Object.entries(activeExam.answer_key)
                                .sort((a,b) => parseInt(a[0]) - parseInt(b[0]))
                                .map(([q, ans]) => (
                                  <tr key={q} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                    <td style={{ padding: '0.25rem', color: 'var(--text-muted)', fontWeight: 600 }}>Q{q}</td>
                                    <td style={{ padding: '0.25rem', fontWeight: 800, color: 'var(--primary)' }}>{ans}</td>
                                  </tr>
                                ))
                              }
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Results overlay display of last graded image */}
                    {latestGradeResult && (
                      <div className="card" style={{ border: '1px solid var(--border)' }}>
                        <h4 style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                          Latest Grade Result
                          <span className="badge badge-success">
                            Student ID: {latestGradeResult.student_id || 'N/A'} — Score: {latestGradeResult.score}/{latestGradeResult.total_questions}
                          </span>
                        </h4>
                        
                        <div className="grade-layout">
                          <div className="image-preview-container" style={{ maxHeight: '400px' }}>
                            <img src={`data:image/png;base64,${latestGradeResult.overlay_image}`} alt="Graded OMR Sheet" />
                          </div>

                          <div className="bubble-sheet-card" style={{ maxHeight: '400px' }}>
                            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Answers Check</h4>
                            {Object.entries(activeExam.answer_key)
                              .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                              .map(([qStr, correctAns]) => {
                                const studentAnsObj = latestGradeResult.answers[qStr];
                                const selected = studentAnsObj ? studentAnsObj.selected : null;
                                const isEmpty = studentAnsObj ? studentAnsObj.is_empty : true;
                                const isAmbiguous = studentAnsObj ? studentAnsObj.is_ambiguous : false;

                                return (
                                  <div key={qStr} className="bubble-row" style={{ padding: '0.25rem 0.5rem' }}>
                                    <span className="bubble-num">{qStr}.</span>
                                    <div className="bubble-options">
                                      {['A', 'B', 'C', 'D', 'E'].map(opt => {
                                        let btnClass = '';
                                        if (opt === correctAns) {
                                          btnClass = 'correct'; // green border/bg
                                        } else if (selected === opt) {
                                          btnClass = 'incorrect'; // red bg
                                        }
                                        return (
                                          <span 
                                            key={opt} 
                                            className={`bubble-btn ${btnClass}`}
                                            style={{ width: '22px', height: '22px', fontSize: '0.7rem', pointerEvents: 'none' }}
                                          >
                                            {opt}
                                          </span>
                                        );
                                      })}
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                        {isEmpty ? '(Empty)' : isAmbiguous ? '(Ambiguous)' : selected === correctAns ? '✓ Correct' : `✗ Marked ${selected}`}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            }
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No exam selected. Select an exam from the left or create one.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SUBMISSIONS HISTORY TAB */}
        {activeTab === 'history' && (
          <div>
            <div className="header-container">
              <div>
                <h1 className="header-title">Grading History</h1>
                <p className="header-subtitle">Review, search, and audit all graded submissions.</p>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search 
                    size={16} 
                    style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
                  />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Search by Student ID..." 
                    style={{ paddingLeft: '2.25rem' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {loadingSubmissions ? (
                <div className="spinner-container">
                  <div className="spinner"></div>
                </div>
              ) : submissions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No submissions recorded. Grade a sheet under an exam to start recording.
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Exam</th>
                        <th>Score</th>
                        <th>Accuracy</th>
                        <th>Graded Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions
                        .filter(sub => (sub.student_id || '').toLowerCase().includes(searchQuery.toLowerCase()))
                        .map(sub => {
                          const exam = exams.find(e => e.id === sub.exam_id);
                          const accuracy = Math.round((sub.score / (sub.total_questions || 50)) * 100);
                          return (
                            <tr key={sub.id}>
                              <td style={{ fontWeight: 700 }}>{sub.student_id || 'N/A'}</td>
                              <td>{exam ? exam.name : 'Unknown Exam'}</td>
                              <td>{sub.score} / {sub.total_questions}</td>
                              <td>
                                <span className={`badge ${accuracy >= 70 ? 'badge-success' : accuracy >= 50 ? 'badge-warning' : 'badge-error'}`}>
                                  {accuracy}%
                                </span>
                              </td>
                              <td>{formatDate(sub.created_at)}</td>
                              <td>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                  onClick={() => viewSubmissionDetails(sub)}
                                >
                                  <Eye size={14} /> Review Details
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Submission Detail Inspection Modal */}
            {selectedSubmission && (
              <div 
                style={{ 
                  position: 'fixed', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  background: 'rgba(0,0,0,0.8)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  zIndex: 999,
                  padding: '2rem'
                }}
              >
                <div className="card" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.2rem' }}>Grading Summary</h3>
                    <button 
                      className="btn btn-danger" 
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                      onClick={() => setSelectedSubmission(null)}
                    >
                      Close
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Student ID</span>
                      <p style={{ fontSize: '1.1rem', fontWeight: 800 }}>{selectedSubmission.student_id || 'N/A'}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Graded On</span>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{formatDate(selectedSubmission.created_at)}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Exam Title</span>
                      <p style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                        {exams.find(e => e.id === selectedSubmission.exam_id)?.name || 'Unknown Exam'}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Score Achieved</span>
                      <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {selectedSubmission.score} / {selectedSubmission.total_questions} (
                        {Math.round((selectedSubmission.score / (selectedSubmission.total_questions || 50)) * 100)}%)
                      </p>
                    </div>
                  </div>

                  {/* Bubble check */}
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Bubble Check</h4>
                  <div className="bubble-sheet-card" style={{ maxHeight: '350px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      {/* Left side */}
                      <div>
                        {Object.entries(selectedSubmission.answers)
                          .sort((a,b) => parseInt(a[0]) - parseInt(b[0]))
                          .slice(0, 25)
                          .map(([qStr, ansObj]) => {
                            const exam = exams.find(e => e.id === selectedSubmission.exam_id);
                            const correctAns = exam?.answer_key[qStr];
                            const selected = ansObj.selected;
                            const isCorrect = selected === correctAns;

                            return (
                              <div key={qStr} className="bubble-row" style={{ padding: '0.2rem 0.5rem', justifyContent: 'space-between' }}>
                                <span className="bubble-num" style={{ width: '20px' }}>{qStr}.</span>
                                <span style={{ fontSize: '0.8rem', color: isCorrect ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                                  {ansObj.is_empty ? 'No Mark' : `Marked "${selected}"`}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  (Key: {correctAns})
                                </span>
                              </div>
                            );
                          })}
                      </div>
                      {/* Right side */}
                      <div>
                        {Object.entries(selectedSubmission.answers)
                          .sort((a,b) => parseInt(a[0]) - parseInt(b[0]))
                          .slice(25)
                          .map(([qStr, ansObj]) => {
                            const exam = exams.find(e => e.id === selectedSubmission.exam_id);
                            const correctAns = exam?.answer_key[qStr];
                            const selected = ansObj.selected;
                            const isCorrect = selected === correctAns;

                            return (
                              <div key={qStr} className="bubble-row" style={{ padding: '0.2rem 0.5rem', justifyContent: 'space-between' }}>
                                <span className="bubble-num" style={{ width: '20px' }}>{qStr}.</span>
                                <span style={{ fontSize: '0.8rem', color: isCorrect ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                                  {ansObj.is_empty ? 'No Mark' : `Marked "${selected}"`}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  (Key: {correctAns})
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
