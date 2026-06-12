'use client'

import { useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import { importStudentsCsv, getClassesAndStudents, toggleStudentVisibility, addStudentManually, getTeachersAndClasses, toggleTeacherClass, getAllProfiles, toggleUserSchool } from '@/app/actions/student_admin'
import styles from './StudentsManagement.module.css'

type CsvRow = {
  schoolcode: string
  klas: string
  klasnummer: string | number
  voornaam: string
}

type ValidationRow = CsvRow & {
  isValid: boolean
  errors: string[]
}

export default function StudentsManagement({ schoolId }: { schoolId: string }) {
  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // CSV State
  const [csvData, setCsvData] = useState<ValidationRow[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Manual Add State
  const [addMode, setAddMode] = useState<string | null>(null) // holds class_id
  const [newNum, setNewNum] = useState('')
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')

  // Teachers State
  const [teachers, setTeachers] = useState<any[]>([])
  const [links, setLinks] = useState<any[]>([])
  const [loadingTeachers, setLoadingTeachers] = useState(false)

  // All Profiles State
  const [allProfiles, setAllProfiles] = useState<any[]>([])
  const [schoolLinks, setSchoolLinks] = useState<any[]>([])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    loadData()
  }, [schoolId])

  const loadData = async () => {
    setLoading(true)
    setLoadingTeachers(true)
    const [res, tRes, pRes] = await Promise.all([
      getClassesAndStudents(schoolId),
      getTeachersAndClasses(schoolId),
      getAllProfiles(schoolId)
    ])
    
    if (res.classes) setClasses(res.classes)
    
    if (tRes.teachers) {
      setTeachers(tRes.teachers)
      setLinks(tRes.links || [])
      setIsSuperAdmin(!!tRes.isSuperAdmin)
    }
    
    if (pRes && pRes.profiles) {
      setAllProfiles(pRes.profiles)
      setSchoolLinks(pRes.linkedUserIds || [])
    }
    
    setLoading(false)
    setLoadingTeachers(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsParsing(true)
    setImportResult(null)
    setCsvData([])

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as CsvRow[]
        
        // Check columns
        if (results.meta.fields) {
          const required = ['schoolcode', 'klas', 'klasnummer', 'voornaam']
          const missing = required.filter(f => !results.meta.fields?.includes(f))
          if (missing.length > 0) {
            alert(`Foutief CSV formaat. Ontbrekende kolommen: ${missing.join(', ')}`)
            setIsParsing(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
            return
          }
        }

        // Validate rows
        const seenCombinations = new Set<string>()
        const validated: ValidationRow[] = rows.map(row => {
          const errors: string[] = []
          
          if (!row.schoolcode) errors.push('Schoolcode ontbreekt')
          if (!row.klas) errors.push('Klas ontbreekt')
          if (!row.klasnummer) errors.push('Klasnummer ontbreekt')
          if (!row.voornaam) errors.push('Voornaam ontbreekt')

          if (row.klas) {
            const k = row.klas.trim()
            if (k.length < 2 || k.length > 3) {
              errors.push('Klas moet 2 of 3 tekens zijn')
            }
            const firstChar = k.charAt(0).toUpperCase()
            if (firstChar !== 'K' && firstChar !== 'L') {
              errors.push('Klas moet starten met K of L')
            }
          }

          if (row.schoolcode && row.klas && row.klasnummer) {
            const combo = `${row.schoolcode}-${row.klas}-${row.klasnummer}`
            if (seenCombinations.has(combo)) {
              errors.push('Duplicaat klasnummer in dit bestand')
            } else {
              seenCombinations.add(combo)
            }
          }

          return {
            ...row,
            klas: row.klas?.trim(),
            voornaam: row.voornaam?.trim(),
            schoolcode: row.schoolcode?.trim(),
            isValid: errors.length === 0,
            errors
          }
        })

        setCsvData(validated)
        setIsParsing(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      },
      error: (err) => {
        alert('Fout bij het lezen van het bestand: ' + err.message)
        setIsParsing(false)
      }
    })
  }

  const handleImport = async () => {
    const validRows = csvData.filter(r => r.isValid)
    if (validRows.length === 0) return

    setImporting(true)
    const res = await importStudentsCsv(validRows)
    
    if (res.error) {
      setImportResult(`Import mislukt: ${res.error}`)
    } else {
      setImportResult(`Succes! ${res.result?.inserted || 0} toegevoegd, ${res.result?.updated || 0} geüpdatet.`)
      setCsvData([]) // Clear on success
      loadData() // Refresh list
    }
    setImporting(false)
  }

  const handleToggleHide = async (studentId: string, current: boolean) => {
    await toggleStudentVisibility(studentId, current)
    loadData()
  }

  const handleManualAdd = async (classId: string) => {
    if (!newNum || !newName) return
    setAddError('')
    
    const num = parseInt(newNum)
    if (isNaN(num)) {
      setAddError('Klasnummer moet een getal zijn')
      return
    }

    const res = await addStudentManually(classId, num, newName)
    if (res.error) {
      setAddError(res.error)
    } else {
      setAddMode(null)
      setNewNum('')
      setNewName('')
      loadData()
    }
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Leerlingen & Klassen</h2>

      {/* CSV IMPORT SECTIE */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>CSV Import</h3>
        <p className={styles.description}>
          Upload een CSV bestand met de kolommen: <strong>schoolcode, klas, klasnummer, voornaam</strong>.
        </p>
        
        <div style={{ marginBottom: '1rem' }}>
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileUpload} 
            ref={fileInputRef}
            disabled={isParsing || importing}
            className={styles.fileInput}
          />
        </div>

        {importResult && (
          <div className={styles.resultAlert}>{importResult}</div>
        )}

        {csvData.length > 0 && (
          <div className={styles.previewContainer}>
            <div className={styles.previewHeader}>
              <h4>Preview ({csvData.length} rijen)</h4>
              <button 
                onClick={handleImport} 
                disabled={importing || !csvData.some(r => r.isValid)}
                className={`${styles.btn} ${styles.btnPrimary}`}
              >
                {importing ? 'Importeren...' : `Importeer ${csvData.filter(r => r.isValid).length} geldige rijen`}
              </button>
            </div>
            
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Klas</th>
                    <th>Nr</th>
                    <th>Voornaam</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {csvData.map((row, i) => (
                    <tr key={i} className={row.isValid ? styles.rowValid : styles.rowInvalid}>
                      <td>{row.schoolcode}</td>
                      <td>{row.klas}</td>
                      <td>{row.klasnummer}</td>
                      <td>{row.voornaam}</td>
                      <td>
                        {row.isValid ? 
                          <span className={styles.statusOk}>Gereed</span> : 
                          <span className={styles.statusError}>{row.errors.join(', ')}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* LEERKRACHTEN KOPPELEN SECTIE */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Leerkrachten Koppelen aan Klassen</h3>
        <p className={styles.description}>
          Bepaald welke klassen zichtbaar zijn in het bestelscherm van elke leerkracht.
        </p>

        {loadingTeachers ? <p>Laden...</p> : teachers.length === 0 ? (
          <p className={styles.description}>Geen leerkrachten gevonden voor deze school. Koppel eerst leerkrachten via het profiel of de database.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Leerkracht</th>
                  <th>Gekoppelde Klassen (Klik om te (ont)koppelen)</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(teacher => (
                  <tr key={teacher.id}>
                    <td style={{ fontWeight: 500 }}>{teacher.first_name} {teacher.last_name}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {classes.map(cls => {
                          const isLinked = links.some(l => l.user_id === teacher.id && l.class_id === cls.id)
                          return (
                            <button
                              key={cls.id}
                              onClick={async () => {
                                await toggleTeacherClass(teacher.id, cls.id, isLinked)
                                loadData()
                              }}
                              className={`${styles.badgeBtn} ${isLinked ? styles.badgeBtnActive : ''}`}
                            >
                              {cls.name}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* LEERKRACHTEN AAN SCHOOL KOPPELEN (ENKEL SUPERADMIN) */}
      {isSuperAdmin && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Leerkrachten Toevoegen aan School <span style={{fontSize: '0.8rem', backgroundColor: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px'}}>Superadmin</span></h3>
          <p className={styles.description}>
            Selecteer welke geregistreerde gebruikers bij deze school horen. Pas als een leerkracht hier is aangevinkt, kun je hem/haar hierboven aan klassen koppelen.
          </p>

          {loadingTeachers ? <p>Laden...</p> : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Gebruiker</th>
                    <th>Rol</th>
                    <th>Gekoppeld aan deze school?</th>
                  </tr>
                </thead>
                <tbody>
                  {allProfiles.map(profile => {
                    const isLinked = schoolLinks.includes(profile.id)
                    return (
                      <tr key={profile.id} style={{ opacity: isLinked ? 1 : 0.6 }}>
                        <td style={{ fontWeight: 500 }}>{profile.first_name} {profile.last_name}</td>
                        <td>{profile.role === 'superadmin' ? 'Superbeheerder' : profile.role === 'admin' ? 'Beheerder' : 'Leerkracht'}</td>
                        <td>
                          <button
                            onClick={async () => {
                              await toggleUserSchool(profile.id, schoolId, isLinked)
                              loadData()
                            }}
                            className={`${styles.badgeBtn} ${isLinked ? styles.badgeBtnActive : ''}`}
                          >
                            {isLinked ? 'Ja (Ontkoppel)' : 'Nee (Koppel)'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* KLASSEN OVERZICHT SECTIE */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Overzicht Klassen (Huidige School)</h3>
        
        {loading ? <p>Laden...</p> : classes.length === 0 ? (
          <p className={styles.description}>Nog geen klassen gevonden voor deze school.</p>
        ) : (
          <div className={styles.classesGrid}>
            {classes.map(cls => (
              <div key={cls.id} className={styles.classBox}>
                <div className={styles.classHeader}>
                  <span className={styles.className}>{cls.name} <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>({cls.level})</span></span>
                  <span className={styles.classCount}>{cls.students?.length || 0} lln</span>
                </div>
                
                <div className={styles.studentsList}>
                  {cls.students?.map((stu: any) => (
                    <div key={stu.id} className={`${styles.studentRow} ${stu.is_hidden ? styles.studentHidden : ''}`}>
                      <div className={styles.studentInfo}>
                        <span className={styles.studentNum}>{stu.class_number}</span>
                        <span className={styles.studentName}>{stu.first_name}</span>
                        {stu.is_hidden && <span className={styles.badgeHidden}>Verborgen</span>}
                      </div>
                      <button 
                        className={styles.iconBtn} 
                        onClick={() => handleToggleHide(stu.id, stu.is_hidden)}
                        title={stu.is_hidden ? "Weer tonen" : "Verbergen voor leerkracht"}
                      >
                        {stu.is_hidden ? '👁️' : '🙈'}
                      </button>
                    </div>
                  ))}
                </div>

                {addMode === cls.id ? (
                  <div className={styles.addForm}>
                    <input type="number" placeholder="Nr" value={newNum} onChange={e => setNewNum(e.target.value)} className={styles.inputSmall} />
                    <input type="text" placeholder="Voornaam" value={newName} onChange={e => setNewName(e.target.value)} className={styles.inputMedium} />
                    <div className={styles.addActions}>
                      <button onClick={() => handleManualAdd(cls.id)} className={styles.iconBtnOk}>✓</button>
                      <button onClick={() => {setAddMode(null); setAddError('');}} className={styles.iconBtnCancel}>✕</button>
                    </div>
                    {addError && <div className={styles.errorText}>{addError}</div>}
                  </div>
                ) : (
                  <button onClick={() => setAddMode(cls.id)} className={styles.addBtn}>
                    + Leerling toevoegen
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
