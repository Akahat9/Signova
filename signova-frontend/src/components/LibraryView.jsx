import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

export default function LibraryView({
  activePanel,
  openLibraryBook,
  signSearch,
  setSignSearch,
  filteredSigns,
  setActivePanel,
  libraryBooks,
  openLearningBook,
  libraryOpeningBookId,
  openLibraryBookId,
  currentLibraryBookPage,
  closeLearningBook,
  libraryBookView,
  setLibraryBookView,
  libraryPageFlip,
  libraryReaderRef,
  speak,
  turnLibraryPage,
  nextLibraryBookPage,
  libraryReaderPage,
}) {
  if (activePanel !== 'library') return null;

  return (
    <>
      <section className={`libraryDashboard ${openLibraryBook ? 'libraryDashboardModalOpen' : ''}`} aria-label="Signova full library">
        <header className="libraryTopBar">
          <div className="libraryTopIdentity">
            <span>Signova Library</span>
          </div>
          <div className="libraryTopActions">
            <label className="librarySearch">
              <span className="librarySearchIcon" aria-hidden="true">
                <i />
              </span>
              <input
                type="search"
                value={signSearch}
                onChange={(event) => setSignSearch(event.target.value)}
                placeholder="Search signs and lessons"
                aria-label="Search Signova library"
              />
              <em>{filteredSigns.length}</em>
            </label>
            <button type="button" className="libraryIconButton" onClick={() => setActivePanel('learn')} aria-label="Open Learn page">
              <span className="librarySketchLearnIcon" aria-hidden="true">
                <i />
              </span>
              <small>Learn</small>
            </button>
          </div>
        </header>

        <section className="libraryHeroSpace">
          <div className="libraryHeroCopy">
            <span className="libraryHeroEyebrow">Your sign-learning shelf</span>
            <h2>What do you want to learn?</h2>
            <p>Browse the alphabet, build everyday vocabulary, or practise complete signed sentences.</p>
            <div className="libraryHeroStats" aria-label="Library lesson counts">
              {libraryBooks.map((book) => (
                <span key={`stat-${book.id}`}>
                  <b>{book.pages.length}</b>
                  <small>{book.eyebrow} lessons</small>
                </span>
              ))}
            </div>
            <div className="libraryHeroActions">
              <button type="button" onClick={() => openLearningBook('letters')}>Start reading</button>
              <button type="button" className="libraryBrowseButton" onClick={() => document.querySelector('.learningBookStage')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Browse all books</button>
            </div>
          </div>
        </section>

        <div className="libraryContentGrid">
          <main className="libraryMainShelf">
            <section className="librarySectionHeader learningBooksHeader">
              <div>
                <span>Learning Shelf</span>
                <strong>Letters, Words, and Sentences Books</strong>
              </div>
              <small>Tap a closed book to open the reader.</small>
            </section>

            <section className="learningBookStage" aria-label="Interactive Signova learning books">
              <div className={`learningBookShelf ${libraryOpeningBookId ? 'hasOpeningBook' : ''}`} role="list">
                {libraryBooks.map((book, index) => (
                  <motion.button
                    type="button"
                    className={`learningBookCover ${book.tone} ${openLibraryBookId === book.id ? 'activeLearningBook' : ''} ${libraryOpeningBookId === book.id ? 'openingLearningBook' : ''}`}
                    key={book.id}
                    onClick={() => openLearningBook(book.id)}
                    layoutId={`signova-book-${book.id}`}
                    style={{ '--book-delay': `${index * 90}ms` }}
                    aria-pressed={openLibraryBookId === book.id}
                  >
                    <span className="bookSpine" aria-hidden="true" />
                    <span className="bookCoverLabel">{book.eyebrow}</span>
                    <strong>{book.coverTitle}</strong>
                    <i aria-hidden="true">{book.icon}</i>
                    <small>{book.subtitle}</small>
                    <em>{book.pages.length} lessons</em>
                  </motion.button>
                ))}
              </div>

              <aside className="learningBookHint">
                <strong>Closed books are ready.</strong>
                <small>Open any module to read signs one page at a time.</small>
              </aside>
            </section>
          </main>
        </div>
      </section>

      {openLibraryBook && currentLibraryBookPage && createPortal((
        <motion.div
          key={`signs-book-overlay-${openLibraryBook.id}`}
          className="signsBookOverlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.28 }}
          role="dialog"
          aria-modal="true"
          aria-label={`${openLibraryBook.title} opened`}
        >
          <motion.div
            className="signsBookBackdrop"
            onClick={closeLearningBook}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
          <motion.section
            key={`signs-book-modal-${openLibraryBook.id}-${libraryBookView}`}
            className={`signsBookModal ${openLibraryBook.tone} ${libraryBookView === 'reader' ? 'readerMode' : 'coverMode'}`}
            initial={{ y: 42, scale: 0.88, opacity: 0, rotateX: 8 }}
            animate={{ y: 0, scale: 1, opacity: 1, rotateX: 0, filter: 'none' }}
            transition={{ type: 'spring', stiffness: 220, damping: 24, mass: 0.85 }}
            style={{ filter: 'none' }}
          >
            <button type="button" className="signsBookClose" onClick={closeLearningBook} aria-label="Close book">×</button>
            {libraryBookView === 'cover' ? (
              <button type="button" className={`signsBookCoverModal ${openLibraryBook.tone}`} onClick={() => setLibraryBookView('reader')}>
                <span>{openLibraryBook.eyebrow}</span>
                <strong>{openLibraryBook.coverTitle}</strong>
                <i aria-hidden="true">{openLibraryBook.icon}</i>
                <p>{openLibraryBook.subtitle}</p>
                <em>{openLibraryBook.pages.length} lessons</em>
                <small>Click cover to open</small>
              </button>
            ) : (
              <article
                className={`signsBookReader3d ${libraryPageFlip ? `isFlipping ${libraryPageFlip}` : ''}`}
                ref={libraryReaderRef}
                aria-live="polite"
              >
                <button type="button" className="signsBookBack" onClick={() => setLibraryBookView('cover')} aria-label="Back to cover">←</button>
                <div className="signsBookStack leftStack" aria-hidden="true" />
                <div className="signsBookStack rightStack" aria-hidden="true" />
                <div className="signsBookSpine" aria-hidden="true" />
                <section className="signsBookPage signsBookLeftPage">
                  <span>{openLibraryBook.eyebrow}</span>
                  <div className="signBookHandArt" aria-hidden="true">
                    <b>{currentLibraryBookPage.sign.slice(0, 2).toUpperCase()}</b>
                    <i />
                  </div>
                  <h3>{currentLibraryBookPage.sign}</h3>
                  <p>{currentLibraryBookPage.usage}</p>
                  <button type="button" onClick={() => speak(currentLibraryBookPage.sign, currentLibraryBookPage.language)}>Practice sign</button>
                </section>
                <button type="button" className="signsBookPage signsBookRightPage" onClick={() => turnLibraryPage(1)} aria-label="Turn to next page">
                  <span>{nextLibraryBookPage?.language || currentLibraryBookPage.language}</span>
                  <div className="signBookHandArt nextHandArt" aria-hidden="true">
                    <b>{nextLibraryBookPage?.sign?.slice(0, 2).toUpperCase() || currentLibraryBookPage.sign.slice(0, 2).toUpperCase()}</b>
                    <i />
                  </div>
                  <h3>{nextLibraryBookPage?.sign || currentLibraryBookPage.sign}</h3>
                  <p>{nextLibraryBookPage?.usage || currentLibraryBookPage.usage}</p>
                  <small>Tap page for next</small>
                </button>
                <div className="turningPage" aria-hidden="true">
                  <span>{nextLibraryBookPage?.sign || currentLibraryBookPage.sign}</span>
                </div>
                <footer className="signsBookControls">
                  <button type="button" onClick={() => turnLibraryPage(-1)} disabled={libraryReaderPage === 0}>Previous</button>
                  <button type="button" onClick={() => speak(currentLibraryBookPage.sign, currentLibraryBookPage.language)}>Play Sign</button>
                  <span>{libraryReaderPage + 1} / {openLibraryBook.pages.length}</span>
                  <button type="button" onClick={() => turnLibraryPage(1)} disabled={libraryReaderPage >= openLibraryBook.pages.length - 1}>Next page</button>
                </footer>
              </article>
            )}
          </motion.section>
        </motion.div>
      ), document.body)}
    </>
  );
}