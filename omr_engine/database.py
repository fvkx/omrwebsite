import sqlite3
import json
from datetime import datetime
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "omr.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create exams table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS exams (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            answer_key TEXT NOT NULL, -- JSON string mapping question number to answer
            created_at TEXT NOT NULL
        )
    """)
    
    # Create submissions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS submissions (
            id TEXT PRIMARY KEY,
            exam_id TEXT NOT NULL,
            student_id TEXT,
            score INTEGER NOT NULL,
            total_questions INTEGER NOT NULL,
            answers TEXT NOT NULL, -- JSON string of student answers
            created_at TEXT NOT NULL,
            FOREIGN KEY (exam_id) REFERENCES exams (id)
        )
    """)
    
    conn.commit()
    conn.close()

def save_exam(exam_id: str, name: str, answer_key: dict) -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.utcnow().isoformat()
    answer_key_str = json.dumps(answer_key)
    
    cursor.execute(
        "INSERT INTO exams (id, name, answer_key, created_at) VALUES (?, ?, ?, ?)",
        (exam_id, name, answer_key_str, created_at)
    )
    conn.commit()
    conn.close()
    return {
        "id": exam_id,
        "name": name,
        "answer_key": answer_key,
        "created_at": created_at
    }

def update_exam(exam_id: str, answer_key: dict) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    answer_key_str = json.dumps(answer_key)
    
    cursor.execute(
        "UPDATE exams SET answer_key = ? WHERE id = ?",
        (answer_key_str, exam_id)
    )
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated

def get_exam(exam_id: str) -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, answer_key, created_at FROM exams WHERE id = ?", (exam_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row["id"],
            "name": row["name"],
            "answer_key": json.loads(row["answer_key"]),
            "created_at": row["created_at"]
        }
    return None

def list_exams() -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, answer_key, created_at FROM exams ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    
    exams = []
    for row in rows:
        exams.append({
            "id": row["id"],
            "name": row["name"],
            "answer_key": json.loads(row["answer_key"]),
            "created_at": row["created_at"]
        })
    return exams

def delete_exam(exam_id: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    # Delete associated submissions first to maintain integrity
    cursor.execute("DELETE FROM submissions WHERE exam_id = ?", (exam_id,))
    # Delete the exam itself
    cursor.execute("DELETE FROM exams WHERE id = ?", (exam_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def save_submission(submission_id: str, exam_id: str, student_id: str, score: int, total_questions: int, answers: dict) -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.utcnow().isoformat()
    answers_str = json.dumps(answers)
    
    cursor.execute(
        "INSERT INTO submissions (id, exam_id, student_id, score, total_questions, answers, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (submission_id, exam_id, student_id, score, total_questions, answers_str, created_at)
    )
    conn.commit()
    conn.close()
    return {
        "id": submission_id,
        "exam_id": exam_id,
        "student_id": student_id,
        "score": score,
        "total_questions": total_questions,
        "answers": answers,
        "created_at": created_at
    }

def list_submissions(exam_id: str = None) -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    if exam_id:
        cursor.execute("SELECT id, exam_id, student_id, score, total_questions, answers, created_at FROM submissions WHERE exam_id = ? ORDER BY created_at DESC", (exam_id,))
    else:
        cursor.execute("SELECT id, exam_id, student_id, score, total_questions, answers, created_at FROM submissions ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    
    submissions = []
    for row in rows:
        submissions.append({
            "id": row["id"],
            "exam_id": row["exam_id"],
            "student_id": row["student_id"],
            "score": row["score"],
            "total_questions": row["total_questions"],
            "answers": json.loads(row["answers"]),
            "created_at": row["created_at"]
        })
    return submissions

# Run database table initialization if executed directly
if __name__ == "__main__":
    init_db()
    print("Database tables initialized successfully.")
