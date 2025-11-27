// script.js - Código Completo

document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.querySelector('.navbar');
    
    // Elementos do Menu Mobile
    const hamburger = document.getElementById('mobile-menu');
    const navMenu = document.querySelector('.nav-links');

    // 1. Lógica do Menu Hambúrguer (Abrir/Fechar)
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active'); // Transforma o ícone em X
            navMenu.classList.toggle('active');   // Faz o menu descer/subir
        });

        // Fecha o menu automaticamente ao clicar em qualquer link
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    } else {
        console.warn('Menu mobile não encontrado no HTML. Verifique os IDs.');
    }

    // 2. Efeito de Fundo na Navbar ao Rolar a Página
    const handleScroll = () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    };
    window.addEventListener('scroll', handleScroll);

    // 3. Marca o Link da Página Atual como "Ativo"
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href').split('/').pop();
        if (linkPath === currentPath) {
            link.classList.add('active');
        }
    });

    // 4. Lógica do Modal de Contato (Popup)
    const modal = document.getElementById('contactModal');
    const btnOpen = document.getElementById('openContactModal');
    const btnClose = document.querySelector('.close-modal');

    if (modal && btnOpen && btnClose) {
        btnOpen.addEventListener('click', (e) => {
            e.preventDefault();
            modal.classList.add('show');
        });

        btnClose.addEventListener('click', () => {
            modal.classList.remove('show');
        });

        // Fecha ao clicar fora da caixa
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });

        // Fecha ao apertar ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('show')) {
                modal.classList.remove('show');
            }
        });
    }
});