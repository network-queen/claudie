#!/usr/bin/env python3
"""
PTY bridge: creates a real pseudo-terminal for a shell process,
relaying stdin/stdout over pipes so Node.js can drive it.

Usage: python3 pty-bridge.py [cols] [rows] [command] [args...]
Default: python3 pty-bridge.py 80 24 /bin/zsh -i
"""
import pty, os, sys, select, struct, fcntl, termios, signal, errno

def set_winsize(fd, rows, cols):
    """Set the terminal window size."""
    winsize = struct.pack('HHHH', rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

def main():
    cols = int(sys.argv[1]) if len(sys.argv) > 1 else 80
    rows = int(sys.argv[2]) if len(sys.argv) > 2 else 24
    cmd = sys.argv[3] if len(sys.argv) > 3 else os.environ.get('SHELL', '/bin/zsh')
    args = sys.argv[3:] if len(sys.argv) > 3 else [cmd, '-i']

    # Create PTY pair
    master_fd, slave_fd = pty.openpty()

    # Set window size
    set_winsize(master_fd, rows, cols)

    pid = os.fork()
    if pid == 0:
        # Child: run shell on the slave side of the PTY
        os.close(master_fd)
        os.setsid()

        # Make slave the controlling terminal
        fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)

        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        if slave_fd > 2:
            os.close(slave_fd)

        os.execvp(cmd, args)
    else:
        # Parent: relay between stdin/stdout and master PTY
        os.close(slave_fd)

        # Handle SIGWINCH for resize (sent by Node when terminal resizes)
        def handle_sigwinch(signum, frame):
            # Read new size from stdin as a special message
            pass
        signal.signal(signal.SIGWINCH, handle_sigwinch)

        # Handle SIGCHLD
        child_exited = False
        def handle_sigchld(signum, frame):
            nonlocal child_exited
            child_exited = True
        signal.signal(signal.SIGCHLD, handle_sigchld)

        # Make stdin non-blocking
        stdin_fd = sys.stdin.buffer.fileno()
        stdout_fd = sys.stdout.buffer.fileno()

        try:
            while not child_exited:
                try:
                    rlist, _, _ = select.select([master_fd, stdin_fd], [], [], 0.1)
                except (select.error, OSError) as e:
                    if hasattr(e, 'errno') and e.errno == errno.EINTR:
                        continue
                    break

                if master_fd in rlist:
                    try:
                        data = os.read(master_fd, 16384)
                        if not data:
                            break
                        os.write(stdout_fd, data)
                    except OSError:
                        break

                if stdin_fd in rlist:
                    try:
                        data = os.read(stdin_fd, 16384)
                        if not data:
                            break
                        # Check for resize escape sequence: \x1b[R<rows>;<cols>
                        if data.startswith(b'\x1b[R'):
                            try:
                                size_str = data[3:].decode('utf-8').strip()
                                r, c = size_str.split(';')
                                set_winsize(master_fd, int(r), int(c))
                                signal.pthread_kill(signal.pthread_sigmask(0, [])[0] if False else 0, 0)
                            except:
                                pass
                            continue
                        os.write(master_fd, data)
                    except OSError:
                        break

        except KeyboardInterrupt:
            pass
        finally:
            os.close(master_fd)
            try:
                os.kill(pid, signal.SIGTERM)
                os.waitpid(pid, 0)
            except:
                pass

if __name__ == '__main__':
    main()
